import 'package:drift/drift.dart';

class OfflinePendingRows extends Table {
  TextColumn get id => text()();
  TextColumn get type => text()();
  TextColumn get payloadJson => text()();
  TextColumn get companyId => text()();
  TextColumn get branchId => text()();
  IntColumn get createdAt => integer()();
  TextColumn get status => text()();
  TextColumn get syncError => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class ListCacheEntries extends Table {
  TextColumn get cacheKey => text()();
  TextColumn get jsonPayload => text()();
  IntColumn get updatedAt => integer()();

  @override
  Set<Column> get primaryKey => {cacheKey};
}

class FormDraftRows extends Table {
  TextColumn get draftKey => text()();
  TextColumn get ownerUserId => text()();
  TextColumn get payloadJson => text()();
  IntColumn get updatedAt => integer()();

  @override
  Set<Column> get primaryKey => {draftKey};
}

class CounterWorkerRows extends Table {
  TextColumn get pinHash => text()();
  TextColumn get userId => text()();
  TextColumn get displayName => text()();
  TextColumn get email => text()();
  TextColumn get role => text()();
  TextColumn get companyId => text()();
  TextColumn get profileId => text().nullable()();
  TextColumn get branchId => text().nullable()();
  IntColumn get enrolledAt => integer()();

  @override
  Set<Column> get primaryKey => {pinHash};
}

class DbMeta extends Table {
  TextColumn get id => text()();
  TextColumn get value => text()();

  @override
  Set<Column> get primaryKey => {id};
}
