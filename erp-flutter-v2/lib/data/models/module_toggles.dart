class ModuleToggles {
  const ModuleToggles({
    required this.rentalModuleEnabled,
    required this.studioModuleEnabled,
    required this.accountingModuleEnabled,
    required this.posModuleEnabled,
  });

  final bool rentalModuleEnabled;
  final bool studioModuleEnabled;
  final bool accountingModuleEnabled;
  final bool posModuleEnabled;

  static const defaults = ModuleToggles(
    rentalModuleEnabled: true,
    studioModuleEnabled: true,
    accountingModuleEnabled: true,
    posModuleEnabled: true,
  );

  static const failClosed = ModuleToggles(
    rentalModuleEnabled: false,
    studioModuleEnabled: false,
    accountingModuleEnabled: false,
    posModuleEnabled: false,
  );
}

enum ModuleConfigStatus { loading, ok, loadError, noCompany }
