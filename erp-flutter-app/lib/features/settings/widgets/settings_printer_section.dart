import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../app/theme/app_colors.dart';
import '../../../data/models/mobile_printer_settings.dart';
import '../../../device/printing/print_service.dart';
import '../../../device/printing/sunmi_channel.dart';
import '../../../device/printing/thermal_encoder.dart';
import '../../auth/providers/repository_providers.dart';

class SettingsPrinterSection extends ConsumerStatefulWidget {
  const SettingsPrinterSection({super.key, required this.companyId});

  final String companyId;

  @override
  ConsumerState<SettingsPrinterSection> createState() => _SettingsPrinterSectionState();
}

class _SettingsPrinterSectionState extends ConsumerState<SettingsPrinterSection> {
  MobilePrinterSettings _settings = MobilePrinterSettings.defaults;
  List<BluetoothDeviceInfo> _devices = [];
  bool _loading = true;
  String? _message;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final repo = ref.read(settingsRepositoryProvider);
    final res = await repo.getMobilePrinterSettings(widget.companyId);
    if (mounted) {
      setState(() {
        _settings = res.settings;
        _loading = false;
      });
    }
  }

  Future<void> _save(MobilePrinterSettings next) async {
    setState(() => _settings = next);
    final err = await ref.read(settingsRepositoryProvider).setMobilePrinterSettings(
          widget.companyId,
          next,
        );
    if (mounted && err != null) {
      setState(() => _message = err);
    }
  }

  Future<void> _refreshBluetooth() async {
    if (await Permission.bluetoothConnect.request().isGranted ||
        !await Permission.bluetoothConnect.isDenied) {
      final devices = await ErpPrinterChannel.listPairedBluetooth();
      if (mounted) setState(() => _devices = devices);
    }
  }

  Future<void> _testPrint() async {
    final lines = ThermalEncoder.formatPlainReceiptLines(
      title: 'TEST RECEIPT',
      transactionNo: 'TEST-001',
      amount: 1,
      branch: 'Flutter ERP',
    );
    final result = await PrintService.printReceiptLines(lines, _settings);
    if (mounted) {
      setState(() => _message = result.ok ? 'Print sent.' : (result.hint ?? 'Print failed.'));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LinearProgressIndicator();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Printer', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        DropdownButtonFormField<MobilePrinterMode>(
          initialValue: _settings.mode,
          decoration: const InputDecoration(labelText: 'Mode', border: OutlineInputBorder()),
          items: const [
            DropdownMenuItem(value: MobilePrinterMode.thermal, child: Text('Thermal')),
            DropdownMenuItem(value: MobilePrinterMode.a4, child: Text('A4 / PDF')),
          ],
          onChanged: (v) {
            if (v != null) _save(_settings.copyWith(mode: v));
          },
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<MobilePrinterPaperSize>(
          initialValue: _settings.paperSize,
          decoration: const InputDecoration(labelText: 'Paper', border: OutlineInputBorder()),
          items: [
            DropdownMenuItem(value: MobilePrinterPaperSize.mm58, child: Text('58mm')),
            DropdownMenuItem(value: MobilePrinterPaperSize.mm80, child: Text('80mm')),
          ],
          onChanged: (v) {
            if (v != null) _save(_settings.copyWith(paperSize: v));
          },
        ),
        SwitchListTile(
          title: const Text('Auto-print after POS'),
          value: _settings.autoPrintReceipt,
          onChanged: (v) => _save(_settings.copyWith(autoPrintReceipt: v)),
        ),
        Row(
          children: [
            Expanded(
              child: DropdownButtonFormField<String?>(
                initialValue: _settings.bluetoothDeviceAddress,
                decoration: const InputDecoration(
                  labelText: 'Bluetooth printer',
                  border: OutlineInputBorder(),
                ),
                items: [
                  const DropdownMenuItem(value: null, child: Text('None')),
                  ..._devices.map(
                    (d) => DropdownMenuItem(
                      value: d.address,
                      child: Text('${d.name} (${d.address})'),
                    ),
                  ),
                ],
                onChanged: (v) => _save(
                  v == null
                      ? _settings.copyWith(clearBluetooth: true)
                      : _settings.copyWith(bluetoothDeviceAddress: v),
                ),
              ),
            ),
            IconButton(
              onPressed: _refreshBluetooth,
              icon: const Icon(Icons.bluetooth_searching),
              tooltip: 'Refresh paired devices',
            ),
          ],
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _testPrint,
          icon: const Icon(Icons.print),
          label: const Text('Test print'),
        ),
        if (_message != null) ...[
          const SizedBox(height: 8),
          Text(_message!, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
        ],
      ],
    );
  }
}
