import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:drift/drift.dart';

import 'db/database.dart';

const _pinSalt = 'erp_mobile_pin_salt_v1';

String hashCounterPin(String pin) {
  final bytes = utf8.encode('$_pinSalt:$pin');
  return sha256.convert(bytes).toString();
}

bool isFourDigitPin(String pin) => RegExp(r'^\d{4}$').hasMatch(pin);

class EnrolledCounterWorker {
  const EnrolledCounterWorker({
    required this.pinHash,
    required this.userId,
    required this.displayName,
    required this.email,
    required this.role,
    required this.companyId,
    this.profileId,
    this.branchId,
    required this.enrolledAt,
  });

  final String pinHash;
  final String userId;
  final String displayName;
  final String email;
  final String role;
  final String companyId;
  final String? profileId;
  final String? branchId;
  final int enrolledAt;
}

class CounterWorkerStore {
  CounterWorkerStore({AppDatabase? db}) : _db = db ?? AppDatabase.instance;

  final AppDatabase _db;

  Future<List<EnrolledCounterWorker>> listEnrolled(String companyId) async {
    final rows = await (_db.select(_db.counterWorkerRows)
          ..where((t) => t.companyId.equals(companyId)))
        .get();
    return rows.map(_fromRow).toList();
  }

  Future<void> saveWorker({
    required String pin,
    required String userId,
    required String displayName,
    required String email,
    required String role,
    required String companyId,
    String? profileId,
    String? branchId,
  }) async {
    if (!isFourDigitPin(pin)) {
      throw ArgumentError('PIN must be exactly 4 digits.');
    }
    final pinHash = hashCounterPin(pin);
    await _db.into(_db.counterWorkerRows).insertOnConflictUpdate(
          CounterWorkerRowsCompanion.insert(
            pinHash: pinHash,
            userId: userId,
            displayName: displayName,
            email: email,
            role: role,
            companyId: companyId,
            profileId: Value(profileId),
            branchId: Value(branchId),
            enrolledAt: DateTime.now().millisecondsSinceEpoch,
          ),
        );
  }

  Future<EnrolledCounterWorker?> verifyPin({
    required String companyId,
    required String userId,
    required String pin,
  }) async {
    if (!isFourDigitPin(pin)) return null;
    final pinHash = hashCounterPin(pin);
    final row = await (_db.select(_db.counterWorkerRows)
          ..where(
            (t) =>
                t.pinHash.equals(pinHash) &
                t.companyId.equals(companyId) &
                t.userId.equals(userId),
          ))
        .getSingleOrNull();
    return row == null ? null : _fromRow(row);
  }

  Future<void> removeWorker(String pinHash) async {
    await (_db.delete(_db.counterWorkerRows)..where((t) => t.pinHash.equals(pinHash))).go();
  }

  EnrolledCounterWorker _fromRow(CounterWorkerRow row) {
    return EnrolledCounterWorker(
      pinHash: row.pinHash,
      userId: row.userId,
      displayName: row.displayName,
      email: row.email,
      role: row.role,
      companyId: row.companyId,
      profileId: row.profileId,
      branchId: row.branchId,
      enrolledAt: row.enrolledAt,
    );
  }
}
