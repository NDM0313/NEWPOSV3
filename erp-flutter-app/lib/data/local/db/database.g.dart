// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'database.dart';

// ignore_for_file: type=lint
class $OfflinePendingRowsTable extends OfflinePendingRows
    with TableInfo<$OfflinePendingRowsTable, OfflinePendingRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OfflinePendingRowsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _typeMeta = const VerificationMeta('type');
  @override
  late final GeneratedColumn<String> type = GeneratedColumn<String>(
    'type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadJsonMeta = const VerificationMeta(
    'payloadJson',
  );
  @override
  late final GeneratedColumn<String> payloadJson = GeneratedColumn<String>(
    'payload_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _companyIdMeta = const VerificationMeta(
    'companyId',
  );
  @override
  late final GeneratedColumn<String> companyId = GeneratedColumn<String>(
    'company_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _branchIdMeta = const VerificationMeta(
    'branchId',
  );
  @override
  late final GeneratedColumn<String> branchId = GeneratedColumn<String>(
    'branch_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<int> createdAt = GeneratedColumn<int>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _syncErrorMeta = const VerificationMeta(
    'syncError',
  );
  @override
  late final GeneratedColumn<String> syncError = GeneratedColumn<String>(
    'sync_error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    type,
    payloadJson,
    companyId,
    branchId,
    createdAt,
    status,
    syncError,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'offline_pending_rows';
  @override
  VerificationContext validateIntegrity(
    Insertable<OfflinePendingRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('type')) {
      context.handle(
        _typeMeta,
        type.isAcceptableOrUnknown(data['type']!, _typeMeta),
      );
    } else if (isInserting) {
      context.missing(_typeMeta);
    }
    if (data.containsKey('payload_json')) {
      context.handle(
        _payloadJsonMeta,
        payloadJson.isAcceptableOrUnknown(
          data['payload_json']!,
          _payloadJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_payloadJsonMeta);
    }
    if (data.containsKey('company_id')) {
      context.handle(
        _companyIdMeta,
        companyId.isAcceptableOrUnknown(data['company_id']!, _companyIdMeta),
      );
    } else if (isInserting) {
      context.missing(_companyIdMeta);
    }
    if (data.containsKey('branch_id')) {
      context.handle(
        _branchIdMeta,
        branchId.isAcceptableOrUnknown(data['branch_id']!, _branchIdMeta),
      );
    } else if (isInserting) {
      context.missing(_branchIdMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    if (data.containsKey('sync_error')) {
      context.handle(
        _syncErrorMeta,
        syncError.isAcceptableOrUnknown(data['sync_error']!, _syncErrorMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  OfflinePendingRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return OfflinePendingRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      type: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}type'],
      )!,
      payloadJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload_json'],
      )!,
      companyId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}company_id'],
      )!,
      branchId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}branch_id'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}created_at'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      syncError: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}sync_error'],
      ),
    );
  }

  @override
  $OfflinePendingRowsTable createAlias(String alias) {
    return $OfflinePendingRowsTable(attachedDatabase, alias);
  }
}

class OfflinePendingRow extends DataClass
    implements Insertable<OfflinePendingRow> {
  final String id;
  final String type;
  final String payloadJson;
  final String companyId;
  final String branchId;
  final int createdAt;
  final String status;
  final String? syncError;
  const OfflinePendingRow({
    required this.id,
    required this.type,
    required this.payloadJson,
    required this.companyId,
    required this.branchId,
    required this.createdAt,
    required this.status,
    this.syncError,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['type'] = Variable<String>(type);
    map['payload_json'] = Variable<String>(payloadJson);
    map['company_id'] = Variable<String>(companyId);
    map['branch_id'] = Variable<String>(branchId);
    map['created_at'] = Variable<int>(createdAt);
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || syncError != null) {
      map['sync_error'] = Variable<String>(syncError);
    }
    return map;
  }

  OfflinePendingRowsCompanion toCompanion(bool nullToAbsent) {
    return OfflinePendingRowsCompanion(
      id: Value(id),
      type: Value(type),
      payloadJson: Value(payloadJson),
      companyId: Value(companyId),
      branchId: Value(branchId),
      createdAt: Value(createdAt),
      status: Value(status),
      syncError: syncError == null && nullToAbsent
          ? const Value.absent()
          : Value(syncError),
    );
  }

  factory OfflinePendingRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return OfflinePendingRow(
      id: serializer.fromJson<String>(json['id']),
      type: serializer.fromJson<String>(json['type']),
      payloadJson: serializer.fromJson<String>(json['payloadJson']),
      companyId: serializer.fromJson<String>(json['companyId']),
      branchId: serializer.fromJson<String>(json['branchId']),
      createdAt: serializer.fromJson<int>(json['createdAt']),
      status: serializer.fromJson<String>(json['status']),
      syncError: serializer.fromJson<String?>(json['syncError']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'type': serializer.toJson<String>(type),
      'payloadJson': serializer.toJson<String>(payloadJson),
      'companyId': serializer.toJson<String>(companyId),
      'branchId': serializer.toJson<String>(branchId),
      'createdAt': serializer.toJson<int>(createdAt),
      'status': serializer.toJson<String>(status),
      'syncError': serializer.toJson<String?>(syncError),
    };
  }

  OfflinePendingRow copyWith({
    String? id,
    String? type,
    String? payloadJson,
    String? companyId,
    String? branchId,
    int? createdAt,
    String? status,
    Value<String?> syncError = const Value.absent(),
  }) => OfflinePendingRow(
    id: id ?? this.id,
    type: type ?? this.type,
    payloadJson: payloadJson ?? this.payloadJson,
    companyId: companyId ?? this.companyId,
    branchId: branchId ?? this.branchId,
    createdAt: createdAt ?? this.createdAt,
    status: status ?? this.status,
    syncError: syncError.present ? syncError.value : this.syncError,
  );
  OfflinePendingRow copyWithCompanion(OfflinePendingRowsCompanion data) {
    return OfflinePendingRow(
      id: data.id.present ? data.id.value : this.id,
      type: data.type.present ? data.type.value : this.type,
      payloadJson: data.payloadJson.present
          ? data.payloadJson.value
          : this.payloadJson,
      companyId: data.companyId.present ? data.companyId.value : this.companyId,
      branchId: data.branchId.present ? data.branchId.value : this.branchId,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      status: data.status.present ? data.status.value : this.status,
      syncError: data.syncError.present ? data.syncError.value : this.syncError,
    );
  }

  @override
  String toString() {
    return (StringBuffer('OfflinePendingRow(')
          ..write('id: $id, ')
          ..write('type: $type, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('companyId: $companyId, ')
          ..write('branchId: $branchId, ')
          ..write('createdAt: $createdAt, ')
          ..write('status: $status, ')
          ..write('syncError: $syncError')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    type,
    payloadJson,
    companyId,
    branchId,
    createdAt,
    status,
    syncError,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OfflinePendingRow &&
          other.id == this.id &&
          other.type == this.type &&
          other.payloadJson == this.payloadJson &&
          other.companyId == this.companyId &&
          other.branchId == this.branchId &&
          other.createdAt == this.createdAt &&
          other.status == this.status &&
          other.syncError == this.syncError);
}

class OfflinePendingRowsCompanion extends UpdateCompanion<OfflinePendingRow> {
  final Value<String> id;
  final Value<String> type;
  final Value<String> payloadJson;
  final Value<String> companyId;
  final Value<String> branchId;
  final Value<int> createdAt;
  final Value<String> status;
  final Value<String?> syncError;
  final Value<int> rowid;
  const OfflinePendingRowsCompanion({
    this.id = const Value.absent(),
    this.type = const Value.absent(),
    this.payloadJson = const Value.absent(),
    this.companyId = const Value.absent(),
    this.branchId = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.status = const Value.absent(),
    this.syncError = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  OfflinePendingRowsCompanion.insert({
    required String id,
    required String type,
    required String payloadJson,
    required String companyId,
    required String branchId,
    required int createdAt,
    required String status,
    this.syncError = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       type = Value(type),
       payloadJson = Value(payloadJson),
       companyId = Value(companyId),
       branchId = Value(branchId),
       createdAt = Value(createdAt),
       status = Value(status);
  static Insertable<OfflinePendingRow> custom({
    Expression<String>? id,
    Expression<String>? type,
    Expression<String>? payloadJson,
    Expression<String>? companyId,
    Expression<String>? branchId,
    Expression<int>? createdAt,
    Expression<String>? status,
    Expression<String>? syncError,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (type != null) 'type': type,
      if (payloadJson != null) 'payload_json': payloadJson,
      if (companyId != null) 'company_id': companyId,
      if (branchId != null) 'branch_id': branchId,
      if (createdAt != null) 'created_at': createdAt,
      if (status != null) 'status': status,
      if (syncError != null) 'sync_error': syncError,
      if (rowid != null) 'rowid': rowid,
    });
  }

  OfflinePendingRowsCompanion copyWith({
    Value<String>? id,
    Value<String>? type,
    Value<String>? payloadJson,
    Value<String>? companyId,
    Value<String>? branchId,
    Value<int>? createdAt,
    Value<String>? status,
    Value<String?>? syncError,
    Value<int>? rowid,
  }) {
    return OfflinePendingRowsCompanion(
      id: id ?? this.id,
      type: type ?? this.type,
      payloadJson: payloadJson ?? this.payloadJson,
      companyId: companyId ?? this.companyId,
      branchId: branchId ?? this.branchId,
      createdAt: createdAt ?? this.createdAt,
      status: status ?? this.status,
      syncError: syncError ?? this.syncError,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (type.present) {
      map['type'] = Variable<String>(type.value);
    }
    if (payloadJson.present) {
      map['payload_json'] = Variable<String>(payloadJson.value);
    }
    if (companyId.present) {
      map['company_id'] = Variable<String>(companyId.value);
    }
    if (branchId.present) {
      map['branch_id'] = Variable<String>(branchId.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<int>(createdAt.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (syncError.present) {
      map['sync_error'] = Variable<String>(syncError.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OfflinePendingRowsCompanion(')
          ..write('id: $id, ')
          ..write('type: $type, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('companyId: $companyId, ')
          ..write('branchId: $branchId, ')
          ..write('createdAt: $createdAt, ')
          ..write('status: $status, ')
          ..write('syncError: $syncError, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ListCacheEntriesTable extends ListCacheEntries
    with TableInfo<$ListCacheEntriesTable, ListCacheEntry> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ListCacheEntriesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _cacheKeyMeta = const VerificationMeta(
    'cacheKey',
  );
  @override
  late final GeneratedColumn<String> cacheKey = GeneratedColumn<String>(
    'cache_key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _jsonPayloadMeta = const VerificationMeta(
    'jsonPayload',
  );
  @override
  late final GeneratedColumn<String> jsonPayload = GeneratedColumn<String>(
    'json_payload',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<int> updatedAt = GeneratedColumn<int>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [cacheKey, jsonPayload, updatedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'list_cache_entries';
  @override
  VerificationContext validateIntegrity(
    Insertable<ListCacheEntry> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('cache_key')) {
      context.handle(
        _cacheKeyMeta,
        cacheKey.isAcceptableOrUnknown(data['cache_key']!, _cacheKeyMeta),
      );
    } else if (isInserting) {
      context.missing(_cacheKeyMeta);
    }
    if (data.containsKey('json_payload')) {
      context.handle(
        _jsonPayloadMeta,
        jsonPayload.isAcceptableOrUnknown(
          data['json_payload']!,
          _jsonPayloadMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_jsonPayloadMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {cacheKey};
  @override
  ListCacheEntry map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ListCacheEntry(
      cacheKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}cache_key'],
      )!,
      jsonPayload: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}json_payload'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $ListCacheEntriesTable createAlias(String alias) {
    return $ListCacheEntriesTable(attachedDatabase, alias);
  }
}

class ListCacheEntry extends DataClass implements Insertable<ListCacheEntry> {
  final String cacheKey;
  final String jsonPayload;
  final int updatedAt;
  const ListCacheEntry({
    required this.cacheKey,
    required this.jsonPayload,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['cache_key'] = Variable<String>(cacheKey);
    map['json_payload'] = Variable<String>(jsonPayload);
    map['updated_at'] = Variable<int>(updatedAt);
    return map;
  }

  ListCacheEntriesCompanion toCompanion(bool nullToAbsent) {
    return ListCacheEntriesCompanion(
      cacheKey: Value(cacheKey),
      jsonPayload: Value(jsonPayload),
      updatedAt: Value(updatedAt),
    );
  }

  factory ListCacheEntry.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ListCacheEntry(
      cacheKey: serializer.fromJson<String>(json['cacheKey']),
      jsonPayload: serializer.fromJson<String>(json['jsonPayload']),
      updatedAt: serializer.fromJson<int>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'cacheKey': serializer.toJson<String>(cacheKey),
      'jsonPayload': serializer.toJson<String>(jsonPayload),
      'updatedAt': serializer.toJson<int>(updatedAt),
    };
  }

  ListCacheEntry copyWith({
    String? cacheKey,
    String? jsonPayload,
    int? updatedAt,
  }) => ListCacheEntry(
    cacheKey: cacheKey ?? this.cacheKey,
    jsonPayload: jsonPayload ?? this.jsonPayload,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  ListCacheEntry copyWithCompanion(ListCacheEntriesCompanion data) {
    return ListCacheEntry(
      cacheKey: data.cacheKey.present ? data.cacheKey.value : this.cacheKey,
      jsonPayload: data.jsonPayload.present
          ? data.jsonPayload.value
          : this.jsonPayload,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ListCacheEntry(')
          ..write('cacheKey: $cacheKey, ')
          ..write('jsonPayload: $jsonPayload, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(cacheKey, jsonPayload, updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ListCacheEntry &&
          other.cacheKey == this.cacheKey &&
          other.jsonPayload == this.jsonPayload &&
          other.updatedAt == this.updatedAt);
}

class ListCacheEntriesCompanion extends UpdateCompanion<ListCacheEntry> {
  final Value<String> cacheKey;
  final Value<String> jsonPayload;
  final Value<int> updatedAt;
  final Value<int> rowid;
  const ListCacheEntriesCompanion({
    this.cacheKey = const Value.absent(),
    this.jsonPayload = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ListCacheEntriesCompanion.insert({
    required String cacheKey,
    required String jsonPayload,
    required int updatedAt,
    this.rowid = const Value.absent(),
  }) : cacheKey = Value(cacheKey),
       jsonPayload = Value(jsonPayload),
       updatedAt = Value(updatedAt);
  static Insertable<ListCacheEntry> custom({
    Expression<String>? cacheKey,
    Expression<String>? jsonPayload,
    Expression<int>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (cacheKey != null) 'cache_key': cacheKey,
      if (jsonPayload != null) 'json_payload': jsonPayload,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ListCacheEntriesCompanion copyWith({
    Value<String>? cacheKey,
    Value<String>? jsonPayload,
    Value<int>? updatedAt,
    Value<int>? rowid,
  }) {
    return ListCacheEntriesCompanion(
      cacheKey: cacheKey ?? this.cacheKey,
      jsonPayload: jsonPayload ?? this.jsonPayload,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (cacheKey.present) {
      map['cache_key'] = Variable<String>(cacheKey.value);
    }
    if (jsonPayload.present) {
      map['json_payload'] = Variable<String>(jsonPayload.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<int>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ListCacheEntriesCompanion(')
          ..write('cacheKey: $cacheKey, ')
          ..write('jsonPayload: $jsonPayload, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $FormDraftRowsTable extends FormDraftRows
    with TableInfo<$FormDraftRowsTable, FormDraftRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $FormDraftRowsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _draftKeyMeta = const VerificationMeta(
    'draftKey',
  );
  @override
  late final GeneratedColumn<String> draftKey = GeneratedColumn<String>(
    'draft_key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _ownerUserIdMeta = const VerificationMeta(
    'ownerUserId',
  );
  @override
  late final GeneratedColumn<String> ownerUserId = GeneratedColumn<String>(
    'owner_user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadJsonMeta = const VerificationMeta(
    'payloadJson',
  );
  @override
  late final GeneratedColumn<String> payloadJson = GeneratedColumn<String>(
    'payload_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<int> updatedAt = GeneratedColumn<int>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    draftKey,
    ownerUserId,
    payloadJson,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'form_draft_rows';
  @override
  VerificationContext validateIntegrity(
    Insertable<FormDraftRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('draft_key')) {
      context.handle(
        _draftKeyMeta,
        draftKey.isAcceptableOrUnknown(data['draft_key']!, _draftKeyMeta),
      );
    } else if (isInserting) {
      context.missing(_draftKeyMeta);
    }
    if (data.containsKey('owner_user_id')) {
      context.handle(
        _ownerUserIdMeta,
        ownerUserId.isAcceptableOrUnknown(
          data['owner_user_id']!,
          _ownerUserIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_ownerUserIdMeta);
    }
    if (data.containsKey('payload_json')) {
      context.handle(
        _payloadJsonMeta,
        payloadJson.isAcceptableOrUnknown(
          data['payload_json']!,
          _payloadJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_payloadJsonMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {draftKey};
  @override
  FormDraftRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return FormDraftRow(
      draftKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}draft_key'],
      )!,
      ownerUserId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}owner_user_id'],
      )!,
      payloadJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload_json'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $FormDraftRowsTable createAlias(String alias) {
    return $FormDraftRowsTable(attachedDatabase, alias);
  }
}

class FormDraftRow extends DataClass implements Insertable<FormDraftRow> {
  final String draftKey;
  final String ownerUserId;
  final String payloadJson;
  final int updatedAt;
  const FormDraftRow({
    required this.draftKey,
    required this.ownerUserId,
    required this.payloadJson,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['draft_key'] = Variable<String>(draftKey);
    map['owner_user_id'] = Variable<String>(ownerUserId);
    map['payload_json'] = Variable<String>(payloadJson);
    map['updated_at'] = Variable<int>(updatedAt);
    return map;
  }

  FormDraftRowsCompanion toCompanion(bool nullToAbsent) {
    return FormDraftRowsCompanion(
      draftKey: Value(draftKey),
      ownerUserId: Value(ownerUserId),
      payloadJson: Value(payloadJson),
      updatedAt: Value(updatedAt),
    );
  }

  factory FormDraftRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return FormDraftRow(
      draftKey: serializer.fromJson<String>(json['draftKey']),
      ownerUserId: serializer.fromJson<String>(json['ownerUserId']),
      payloadJson: serializer.fromJson<String>(json['payloadJson']),
      updatedAt: serializer.fromJson<int>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'draftKey': serializer.toJson<String>(draftKey),
      'ownerUserId': serializer.toJson<String>(ownerUserId),
      'payloadJson': serializer.toJson<String>(payloadJson),
      'updatedAt': serializer.toJson<int>(updatedAt),
    };
  }

  FormDraftRow copyWith({
    String? draftKey,
    String? ownerUserId,
    String? payloadJson,
    int? updatedAt,
  }) => FormDraftRow(
    draftKey: draftKey ?? this.draftKey,
    ownerUserId: ownerUserId ?? this.ownerUserId,
    payloadJson: payloadJson ?? this.payloadJson,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  FormDraftRow copyWithCompanion(FormDraftRowsCompanion data) {
    return FormDraftRow(
      draftKey: data.draftKey.present ? data.draftKey.value : this.draftKey,
      ownerUserId: data.ownerUserId.present
          ? data.ownerUserId.value
          : this.ownerUserId,
      payloadJson: data.payloadJson.present
          ? data.payloadJson.value
          : this.payloadJson,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('FormDraftRow(')
          ..write('draftKey: $draftKey, ')
          ..write('ownerUserId: $ownerUserId, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(draftKey, ownerUserId, payloadJson, updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is FormDraftRow &&
          other.draftKey == this.draftKey &&
          other.ownerUserId == this.ownerUserId &&
          other.payloadJson == this.payloadJson &&
          other.updatedAt == this.updatedAt);
}

class FormDraftRowsCompanion extends UpdateCompanion<FormDraftRow> {
  final Value<String> draftKey;
  final Value<String> ownerUserId;
  final Value<String> payloadJson;
  final Value<int> updatedAt;
  final Value<int> rowid;
  const FormDraftRowsCompanion({
    this.draftKey = const Value.absent(),
    this.ownerUserId = const Value.absent(),
    this.payloadJson = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  FormDraftRowsCompanion.insert({
    required String draftKey,
    required String ownerUserId,
    required String payloadJson,
    required int updatedAt,
    this.rowid = const Value.absent(),
  }) : draftKey = Value(draftKey),
       ownerUserId = Value(ownerUserId),
       payloadJson = Value(payloadJson),
       updatedAt = Value(updatedAt);
  static Insertable<FormDraftRow> custom({
    Expression<String>? draftKey,
    Expression<String>? ownerUserId,
    Expression<String>? payloadJson,
    Expression<int>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (draftKey != null) 'draft_key': draftKey,
      if (ownerUserId != null) 'owner_user_id': ownerUserId,
      if (payloadJson != null) 'payload_json': payloadJson,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  FormDraftRowsCompanion copyWith({
    Value<String>? draftKey,
    Value<String>? ownerUserId,
    Value<String>? payloadJson,
    Value<int>? updatedAt,
    Value<int>? rowid,
  }) {
    return FormDraftRowsCompanion(
      draftKey: draftKey ?? this.draftKey,
      ownerUserId: ownerUserId ?? this.ownerUserId,
      payloadJson: payloadJson ?? this.payloadJson,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (draftKey.present) {
      map['draft_key'] = Variable<String>(draftKey.value);
    }
    if (ownerUserId.present) {
      map['owner_user_id'] = Variable<String>(ownerUserId.value);
    }
    if (payloadJson.present) {
      map['payload_json'] = Variable<String>(payloadJson.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<int>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('FormDraftRowsCompanion(')
          ..write('draftKey: $draftKey, ')
          ..write('ownerUserId: $ownerUserId, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CounterWorkerRowsTable extends CounterWorkerRows
    with TableInfo<$CounterWorkerRowsTable, CounterWorkerRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CounterWorkerRowsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _pinHashMeta = const VerificationMeta(
    'pinHash',
  );
  @override
  late final GeneratedColumn<String> pinHash = GeneratedColumn<String>(
    'pin_hash',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _displayNameMeta = const VerificationMeta(
    'displayName',
  );
  @override
  late final GeneratedColumn<String> displayName = GeneratedColumn<String>(
    'display_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _emailMeta = const VerificationMeta('email');
  @override
  late final GeneratedColumn<String> email = GeneratedColumn<String>(
    'email',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _roleMeta = const VerificationMeta('role');
  @override
  late final GeneratedColumn<String> role = GeneratedColumn<String>(
    'role',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _companyIdMeta = const VerificationMeta(
    'companyId',
  );
  @override
  late final GeneratedColumn<String> companyId = GeneratedColumn<String>(
    'company_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _profileIdMeta = const VerificationMeta(
    'profileId',
  );
  @override
  late final GeneratedColumn<String> profileId = GeneratedColumn<String>(
    'profile_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _branchIdMeta = const VerificationMeta(
    'branchId',
  );
  @override
  late final GeneratedColumn<String> branchId = GeneratedColumn<String>(
    'branch_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _enrolledAtMeta = const VerificationMeta(
    'enrolledAt',
  );
  @override
  late final GeneratedColumn<int> enrolledAt = GeneratedColumn<int>(
    'enrolled_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    pinHash,
    userId,
    displayName,
    email,
    role,
    companyId,
    profileId,
    branchId,
    enrolledAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'counter_worker_rows';
  @override
  VerificationContext validateIntegrity(
    Insertable<CounterWorkerRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('pin_hash')) {
      context.handle(
        _pinHashMeta,
        pinHash.isAcceptableOrUnknown(data['pin_hash']!, _pinHashMeta),
      );
    } else if (isInserting) {
      context.missing(_pinHashMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('display_name')) {
      context.handle(
        _displayNameMeta,
        displayName.isAcceptableOrUnknown(
          data['display_name']!,
          _displayNameMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_displayNameMeta);
    }
    if (data.containsKey('email')) {
      context.handle(
        _emailMeta,
        email.isAcceptableOrUnknown(data['email']!, _emailMeta),
      );
    } else if (isInserting) {
      context.missing(_emailMeta);
    }
    if (data.containsKey('role')) {
      context.handle(
        _roleMeta,
        role.isAcceptableOrUnknown(data['role']!, _roleMeta),
      );
    } else if (isInserting) {
      context.missing(_roleMeta);
    }
    if (data.containsKey('company_id')) {
      context.handle(
        _companyIdMeta,
        companyId.isAcceptableOrUnknown(data['company_id']!, _companyIdMeta),
      );
    } else if (isInserting) {
      context.missing(_companyIdMeta);
    }
    if (data.containsKey('profile_id')) {
      context.handle(
        _profileIdMeta,
        profileId.isAcceptableOrUnknown(data['profile_id']!, _profileIdMeta),
      );
    }
    if (data.containsKey('branch_id')) {
      context.handle(
        _branchIdMeta,
        branchId.isAcceptableOrUnknown(data['branch_id']!, _branchIdMeta),
      );
    }
    if (data.containsKey('enrolled_at')) {
      context.handle(
        _enrolledAtMeta,
        enrolledAt.isAcceptableOrUnknown(data['enrolled_at']!, _enrolledAtMeta),
      );
    } else if (isInserting) {
      context.missing(_enrolledAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {pinHash};
  @override
  CounterWorkerRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CounterWorkerRow(
      pinHash: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}pin_hash'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      displayName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}display_name'],
      )!,
      email: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}email'],
      )!,
      role: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}role'],
      )!,
      companyId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}company_id'],
      )!,
      profileId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}profile_id'],
      ),
      branchId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}branch_id'],
      ),
      enrolledAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}enrolled_at'],
      )!,
    );
  }

  @override
  $CounterWorkerRowsTable createAlias(String alias) {
    return $CounterWorkerRowsTable(attachedDatabase, alias);
  }
}

class CounterWorkerRow extends DataClass
    implements Insertable<CounterWorkerRow> {
  final String pinHash;
  final String userId;
  final String displayName;
  final String email;
  final String role;
  final String companyId;
  final String? profileId;
  final String? branchId;
  final int enrolledAt;
  const CounterWorkerRow({
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
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['pin_hash'] = Variable<String>(pinHash);
    map['user_id'] = Variable<String>(userId);
    map['display_name'] = Variable<String>(displayName);
    map['email'] = Variable<String>(email);
    map['role'] = Variable<String>(role);
    map['company_id'] = Variable<String>(companyId);
    if (!nullToAbsent || profileId != null) {
      map['profile_id'] = Variable<String>(profileId);
    }
    if (!nullToAbsent || branchId != null) {
      map['branch_id'] = Variable<String>(branchId);
    }
    map['enrolled_at'] = Variable<int>(enrolledAt);
    return map;
  }

  CounterWorkerRowsCompanion toCompanion(bool nullToAbsent) {
    return CounterWorkerRowsCompanion(
      pinHash: Value(pinHash),
      userId: Value(userId),
      displayName: Value(displayName),
      email: Value(email),
      role: Value(role),
      companyId: Value(companyId),
      profileId: profileId == null && nullToAbsent
          ? const Value.absent()
          : Value(profileId),
      branchId: branchId == null && nullToAbsent
          ? const Value.absent()
          : Value(branchId),
      enrolledAt: Value(enrolledAt),
    );
  }

  factory CounterWorkerRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CounterWorkerRow(
      pinHash: serializer.fromJson<String>(json['pinHash']),
      userId: serializer.fromJson<String>(json['userId']),
      displayName: serializer.fromJson<String>(json['displayName']),
      email: serializer.fromJson<String>(json['email']),
      role: serializer.fromJson<String>(json['role']),
      companyId: serializer.fromJson<String>(json['companyId']),
      profileId: serializer.fromJson<String?>(json['profileId']),
      branchId: serializer.fromJson<String?>(json['branchId']),
      enrolledAt: serializer.fromJson<int>(json['enrolledAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'pinHash': serializer.toJson<String>(pinHash),
      'userId': serializer.toJson<String>(userId),
      'displayName': serializer.toJson<String>(displayName),
      'email': serializer.toJson<String>(email),
      'role': serializer.toJson<String>(role),
      'companyId': serializer.toJson<String>(companyId),
      'profileId': serializer.toJson<String?>(profileId),
      'branchId': serializer.toJson<String?>(branchId),
      'enrolledAt': serializer.toJson<int>(enrolledAt),
    };
  }

  CounterWorkerRow copyWith({
    String? pinHash,
    String? userId,
    String? displayName,
    String? email,
    String? role,
    String? companyId,
    Value<String?> profileId = const Value.absent(),
    Value<String?> branchId = const Value.absent(),
    int? enrolledAt,
  }) => CounterWorkerRow(
    pinHash: pinHash ?? this.pinHash,
    userId: userId ?? this.userId,
    displayName: displayName ?? this.displayName,
    email: email ?? this.email,
    role: role ?? this.role,
    companyId: companyId ?? this.companyId,
    profileId: profileId.present ? profileId.value : this.profileId,
    branchId: branchId.present ? branchId.value : this.branchId,
    enrolledAt: enrolledAt ?? this.enrolledAt,
  );
  CounterWorkerRow copyWithCompanion(CounterWorkerRowsCompanion data) {
    return CounterWorkerRow(
      pinHash: data.pinHash.present ? data.pinHash.value : this.pinHash,
      userId: data.userId.present ? data.userId.value : this.userId,
      displayName: data.displayName.present
          ? data.displayName.value
          : this.displayName,
      email: data.email.present ? data.email.value : this.email,
      role: data.role.present ? data.role.value : this.role,
      companyId: data.companyId.present ? data.companyId.value : this.companyId,
      profileId: data.profileId.present ? data.profileId.value : this.profileId,
      branchId: data.branchId.present ? data.branchId.value : this.branchId,
      enrolledAt: data.enrolledAt.present
          ? data.enrolledAt.value
          : this.enrolledAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CounterWorkerRow(')
          ..write('pinHash: $pinHash, ')
          ..write('userId: $userId, ')
          ..write('displayName: $displayName, ')
          ..write('email: $email, ')
          ..write('role: $role, ')
          ..write('companyId: $companyId, ')
          ..write('profileId: $profileId, ')
          ..write('branchId: $branchId, ')
          ..write('enrolledAt: $enrolledAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    pinHash,
    userId,
    displayName,
    email,
    role,
    companyId,
    profileId,
    branchId,
    enrolledAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CounterWorkerRow &&
          other.pinHash == this.pinHash &&
          other.userId == this.userId &&
          other.displayName == this.displayName &&
          other.email == this.email &&
          other.role == this.role &&
          other.companyId == this.companyId &&
          other.profileId == this.profileId &&
          other.branchId == this.branchId &&
          other.enrolledAt == this.enrolledAt);
}

class CounterWorkerRowsCompanion extends UpdateCompanion<CounterWorkerRow> {
  final Value<String> pinHash;
  final Value<String> userId;
  final Value<String> displayName;
  final Value<String> email;
  final Value<String> role;
  final Value<String> companyId;
  final Value<String?> profileId;
  final Value<String?> branchId;
  final Value<int> enrolledAt;
  final Value<int> rowid;
  const CounterWorkerRowsCompanion({
    this.pinHash = const Value.absent(),
    this.userId = const Value.absent(),
    this.displayName = const Value.absent(),
    this.email = const Value.absent(),
    this.role = const Value.absent(),
    this.companyId = const Value.absent(),
    this.profileId = const Value.absent(),
    this.branchId = const Value.absent(),
    this.enrolledAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CounterWorkerRowsCompanion.insert({
    required String pinHash,
    required String userId,
    required String displayName,
    required String email,
    required String role,
    required String companyId,
    this.profileId = const Value.absent(),
    this.branchId = const Value.absent(),
    required int enrolledAt,
    this.rowid = const Value.absent(),
  }) : pinHash = Value(pinHash),
       userId = Value(userId),
       displayName = Value(displayName),
       email = Value(email),
       role = Value(role),
       companyId = Value(companyId),
       enrolledAt = Value(enrolledAt);
  static Insertable<CounterWorkerRow> custom({
    Expression<String>? pinHash,
    Expression<String>? userId,
    Expression<String>? displayName,
    Expression<String>? email,
    Expression<String>? role,
    Expression<String>? companyId,
    Expression<String>? profileId,
    Expression<String>? branchId,
    Expression<int>? enrolledAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (pinHash != null) 'pin_hash': pinHash,
      if (userId != null) 'user_id': userId,
      if (displayName != null) 'display_name': displayName,
      if (email != null) 'email': email,
      if (role != null) 'role': role,
      if (companyId != null) 'company_id': companyId,
      if (profileId != null) 'profile_id': profileId,
      if (branchId != null) 'branch_id': branchId,
      if (enrolledAt != null) 'enrolled_at': enrolledAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CounterWorkerRowsCompanion copyWith({
    Value<String>? pinHash,
    Value<String>? userId,
    Value<String>? displayName,
    Value<String>? email,
    Value<String>? role,
    Value<String>? companyId,
    Value<String?>? profileId,
    Value<String?>? branchId,
    Value<int>? enrolledAt,
    Value<int>? rowid,
  }) {
    return CounterWorkerRowsCompanion(
      pinHash: pinHash ?? this.pinHash,
      userId: userId ?? this.userId,
      displayName: displayName ?? this.displayName,
      email: email ?? this.email,
      role: role ?? this.role,
      companyId: companyId ?? this.companyId,
      profileId: profileId ?? this.profileId,
      branchId: branchId ?? this.branchId,
      enrolledAt: enrolledAt ?? this.enrolledAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (pinHash.present) {
      map['pin_hash'] = Variable<String>(pinHash.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (displayName.present) {
      map['display_name'] = Variable<String>(displayName.value);
    }
    if (email.present) {
      map['email'] = Variable<String>(email.value);
    }
    if (role.present) {
      map['role'] = Variable<String>(role.value);
    }
    if (companyId.present) {
      map['company_id'] = Variable<String>(companyId.value);
    }
    if (profileId.present) {
      map['profile_id'] = Variable<String>(profileId.value);
    }
    if (branchId.present) {
      map['branch_id'] = Variable<String>(branchId.value);
    }
    if (enrolledAt.present) {
      map['enrolled_at'] = Variable<int>(enrolledAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CounterWorkerRowsCompanion(')
          ..write('pinHash: $pinHash, ')
          ..write('userId: $userId, ')
          ..write('displayName: $displayName, ')
          ..write('email: $email, ')
          ..write('role: $role, ')
          ..write('companyId: $companyId, ')
          ..write('profileId: $profileId, ')
          ..write('branchId: $branchId, ')
          ..write('enrolledAt: $enrolledAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $DbMetaTable extends DbMeta with TableInfo<$DbMetaTable, DbMetaData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DbMetaTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _valueMeta = const VerificationMeta('value');
  @override
  late final GeneratedColumn<String> value = GeneratedColumn<String>(
    'value',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [id, value];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'db_meta';
  @override
  VerificationContext validateIntegrity(
    Insertable<DbMetaData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('value')) {
      context.handle(
        _valueMeta,
        value.isAcceptableOrUnknown(data['value']!, _valueMeta),
      );
    } else if (isInserting) {
      context.missing(_valueMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  DbMetaData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DbMetaData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      value: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}value'],
      )!,
    );
  }

  @override
  $DbMetaTable createAlias(String alias) {
    return $DbMetaTable(attachedDatabase, alias);
  }
}

class DbMetaData extends DataClass implements Insertable<DbMetaData> {
  final String id;
  final String value;
  const DbMetaData({required this.id, required this.value});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['value'] = Variable<String>(value);
    return map;
  }

  DbMetaCompanion toCompanion(bool nullToAbsent) {
    return DbMetaCompanion(id: Value(id), value: Value(value));
  }

  factory DbMetaData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DbMetaData(
      id: serializer.fromJson<String>(json['id']),
      value: serializer.fromJson<String>(json['value']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'value': serializer.toJson<String>(value),
    };
  }

  DbMetaData copyWith({String? id, String? value}) =>
      DbMetaData(id: id ?? this.id, value: value ?? this.value);
  DbMetaData copyWithCompanion(DbMetaCompanion data) {
    return DbMetaData(
      id: data.id.present ? data.id.value : this.id,
      value: data.value.present ? data.value.value : this.value,
    );
  }

  @override
  String toString() {
    return (StringBuffer('DbMetaData(')
          ..write('id: $id, ')
          ..write('value: $value')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, value);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DbMetaData && other.id == this.id && other.value == this.value);
}

class DbMetaCompanion extends UpdateCompanion<DbMetaData> {
  final Value<String> id;
  final Value<String> value;
  final Value<int> rowid;
  const DbMetaCompanion({
    this.id = const Value.absent(),
    this.value = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  DbMetaCompanion.insert({
    required String id,
    required String value,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       value = Value(value);
  static Insertable<DbMetaData> custom({
    Expression<String>? id,
    Expression<String>? value,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (value != null) 'value': value,
      if (rowid != null) 'rowid': rowid,
    });
  }

  DbMetaCompanion copyWith({
    Value<String>? id,
    Value<String>? value,
    Value<int>? rowid,
  }) {
    return DbMetaCompanion(
      id: id ?? this.id,
      value: value ?? this.value,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (value.present) {
      map['value'] = Variable<String>(value.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DbMetaCompanion(')
          ..write('id: $id, ')
          ..write('value: $value, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $OfflinePendingRowsTable offlinePendingRows =
      $OfflinePendingRowsTable(this);
  late final $ListCacheEntriesTable listCacheEntries = $ListCacheEntriesTable(
    this,
  );
  late final $FormDraftRowsTable formDraftRows = $FormDraftRowsTable(this);
  late final $CounterWorkerRowsTable counterWorkerRows =
      $CounterWorkerRowsTable(this);
  late final $DbMetaTable dbMeta = $DbMetaTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    offlinePendingRows,
    listCacheEntries,
    formDraftRows,
    counterWorkerRows,
    dbMeta,
  ];
}

typedef $$OfflinePendingRowsTableCreateCompanionBuilder =
    OfflinePendingRowsCompanion Function({
      required String id,
      required String type,
      required String payloadJson,
      required String companyId,
      required String branchId,
      required int createdAt,
      required String status,
      Value<String?> syncError,
      Value<int> rowid,
    });
typedef $$OfflinePendingRowsTableUpdateCompanionBuilder =
    OfflinePendingRowsCompanion Function({
      Value<String> id,
      Value<String> type,
      Value<String> payloadJson,
      Value<String> companyId,
      Value<String> branchId,
      Value<int> createdAt,
      Value<String> status,
      Value<String?> syncError,
      Value<int> rowid,
    });

class $$OfflinePendingRowsTableFilterComposer
    extends Composer<_$AppDatabase, $OfflinePendingRowsTable> {
  $$OfflinePendingRowsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get companyId => $composableBuilder(
    column: $table.companyId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get syncError => $composableBuilder(
    column: $table.syncError,
    builder: (column) => ColumnFilters(column),
  );
}

class $$OfflinePendingRowsTableOrderingComposer
    extends Composer<_$AppDatabase, $OfflinePendingRowsTable> {
  $$OfflinePendingRowsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get companyId => $composableBuilder(
    column: $table.companyId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get syncError => $composableBuilder(
    column: $table.syncError,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$OfflinePendingRowsTableAnnotationComposer
    extends Composer<_$AppDatabase, $OfflinePendingRowsTable> {
  $$OfflinePendingRowsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get type =>
      $composableBuilder(column: $table.type, builder: (column) => column);

  GeneratedColumn<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => column,
  );

  GeneratedColumn<String> get companyId =>
      $composableBuilder(column: $table.companyId, builder: (column) => column);

  GeneratedColumn<String> get branchId =>
      $composableBuilder(column: $table.branchId, builder: (column) => column);

  GeneratedColumn<int> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get syncError =>
      $composableBuilder(column: $table.syncError, builder: (column) => column);
}

class $$OfflinePendingRowsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $OfflinePendingRowsTable,
          OfflinePendingRow,
          $$OfflinePendingRowsTableFilterComposer,
          $$OfflinePendingRowsTableOrderingComposer,
          $$OfflinePendingRowsTableAnnotationComposer,
          $$OfflinePendingRowsTableCreateCompanionBuilder,
          $$OfflinePendingRowsTableUpdateCompanionBuilder,
          (
            OfflinePendingRow,
            BaseReferences<
              _$AppDatabase,
              $OfflinePendingRowsTable,
              OfflinePendingRow
            >,
          ),
          OfflinePendingRow,
          PrefetchHooks Function()
        > {
  $$OfflinePendingRowsTableTableManager(
    _$AppDatabase db,
    $OfflinePendingRowsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OfflinePendingRowsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OfflinePendingRowsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OfflinePendingRowsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> type = const Value.absent(),
                Value<String> payloadJson = const Value.absent(),
                Value<String> companyId = const Value.absent(),
                Value<String> branchId = const Value.absent(),
                Value<int> createdAt = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<String?> syncError = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => OfflinePendingRowsCompanion(
                id: id,
                type: type,
                payloadJson: payloadJson,
                companyId: companyId,
                branchId: branchId,
                createdAt: createdAt,
                status: status,
                syncError: syncError,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String type,
                required String payloadJson,
                required String companyId,
                required String branchId,
                required int createdAt,
                required String status,
                Value<String?> syncError = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => OfflinePendingRowsCompanion.insert(
                id: id,
                type: type,
                payloadJson: payloadJson,
                companyId: companyId,
                branchId: branchId,
                createdAt: createdAt,
                status: status,
                syncError: syncError,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$OfflinePendingRowsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $OfflinePendingRowsTable,
      OfflinePendingRow,
      $$OfflinePendingRowsTableFilterComposer,
      $$OfflinePendingRowsTableOrderingComposer,
      $$OfflinePendingRowsTableAnnotationComposer,
      $$OfflinePendingRowsTableCreateCompanionBuilder,
      $$OfflinePendingRowsTableUpdateCompanionBuilder,
      (
        OfflinePendingRow,
        BaseReferences<
          _$AppDatabase,
          $OfflinePendingRowsTable,
          OfflinePendingRow
        >,
      ),
      OfflinePendingRow,
      PrefetchHooks Function()
    >;
typedef $$ListCacheEntriesTableCreateCompanionBuilder =
    ListCacheEntriesCompanion Function({
      required String cacheKey,
      required String jsonPayload,
      required int updatedAt,
      Value<int> rowid,
    });
typedef $$ListCacheEntriesTableUpdateCompanionBuilder =
    ListCacheEntriesCompanion Function({
      Value<String> cacheKey,
      Value<String> jsonPayload,
      Value<int> updatedAt,
      Value<int> rowid,
    });

class $$ListCacheEntriesTableFilterComposer
    extends Composer<_$AppDatabase, $ListCacheEntriesTable> {
  $$ListCacheEntriesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get cacheKey => $composableBuilder(
    column: $table.cacheKey,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get jsonPayload => $composableBuilder(
    column: $table.jsonPayload,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ListCacheEntriesTableOrderingComposer
    extends Composer<_$AppDatabase, $ListCacheEntriesTable> {
  $$ListCacheEntriesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get cacheKey => $composableBuilder(
    column: $table.cacheKey,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get jsonPayload => $composableBuilder(
    column: $table.jsonPayload,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ListCacheEntriesTableAnnotationComposer
    extends Composer<_$AppDatabase, $ListCacheEntriesTable> {
  $$ListCacheEntriesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get cacheKey =>
      $composableBuilder(column: $table.cacheKey, builder: (column) => column);

  GeneratedColumn<String> get jsonPayload => $composableBuilder(
    column: $table.jsonPayload,
    builder: (column) => column,
  );

  GeneratedColumn<int> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$ListCacheEntriesTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ListCacheEntriesTable,
          ListCacheEntry,
          $$ListCacheEntriesTableFilterComposer,
          $$ListCacheEntriesTableOrderingComposer,
          $$ListCacheEntriesTableAnnotationComposer,
          $$ListCacheEntriesTableCreateCompanionBuilder,
          $$ListCacheEntriesTableUpdateCompanionBuilder,
          (
            ListCacheEntry,
            BaseReferences<
              _$AppDatabase,
              $ListCacheEntriesTable,
              ListCacheEntry
            >,
          ),
          ListCacheEntry,
          PrefetchHooks Function()
        > {
  $$ListCacheEntriesTableTableManager(
    _$AppDatabase db,
    $ListCacheEntriesTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ListCacheEntriesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ListCacheEntriesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ListCacheEntriesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> cacheKey = const Value.absent(),
                Value<String> jsonPayload = const Value.absent(),
                Value<int> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ListCacheEntriesCompanion(
                cacheKey: cacheKey,
                jsonPayload: jsonPayload,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String cacheKey,
                required String jsonPayload,
                required int updatedAt,
                Value<int> rowid = const Value.absent(),
              }) => ListCacheEntriesCompanion.insert(
                cacheKey: cacheKey,
                jsonPayload: jsonPayload,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ListCacheEntriesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ListCacheEntriesTable,
      ListCacheEntry,
      $$ListCacheEntriesTableFilterComposer,
      $$ListCacheEntriesTableOrderingComposer,
      $$ListCacheEntriesTableAnnotationComposer,
      $$ListCacheEntriesTableCreateCompanionBuilder,
      $$ListCacheEntriesTableUpdateCompanionBuilder,
      (
        ListCacheEntry,
        BaseReferences<_$AppDatabase, $ListCacheEntriesTable, ListCacheEntry>,
      ),
      ListCacheEntry,
      PrefetchHooks Function()
    >;
typedef $$FormDraftRowsTableCreateCompanionBuilder =
    FormDraftRowsCompanion Function({
      required String draftKey,
      required String ownerUserId,
      required String payloadJson,
      required int updatedAt,
      Value<int> rowid,
    });
typedef $$FormDraftRowsTableUpdateCompanionBuilder =
    FormDraftRowsCompanion Function({
      Value<String> draftKey,
      Value<String> ownerUserId,
      Value<String> payloadJson,
      Value<int> updatedAt,
      Value<int> rowid,
    });

class $$FormDraftRowsTableFilterComposer
    extends Composer<_$AppDatabase, $FormDraftRowsTable> {
  $$FormDraftRowsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get draftKey => $composableBuilder(
    column: $table.draftKey,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get ownerUserId => $composableBuilder(
    column: $table.ownerUserId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$FormDraftRowsTableOrderingComposer
    extends Composer<_$AppDatabase, $FormDraftRowsTable> {
  $$FormDraftRowsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get draftKey => $composableBuilder(
    column: $table.draftKey,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get ownerUserId => $composableBuilder(
    column: $table.ownerUserId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$FormDraftRowsTableAnnotationComposer
    extends Composer<_$AppDatabase, $FormDraftRowsTable> {
  $$FormDraftRowsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get draftKey =>
      $composableBuilder(column: $table.draftKey, builder: (column) => column);

  GeneratedColumn<String> get ownerUserId => $composableBuilder(
    column: $table.ownerUserId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => column,
  );

  GeneratedColumn<int> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$FormDraftRowsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $FormDraftRowsTable,
          FormDraftRow,
          $$FormDraftRowsTableFilterComposer,
          $$FormDraftRowsTableOrderingComposer,
          $$FormDraftRowsTableAnnotationComposer,
          $$FormDraftRowsTableCreateCompanionBuilder,
          $$FormDraftRowsTableUpdateCompanionBuilder,
          (
            FormDraftRow,
            BaseReferences<_$AppDatabase, $FormDraftRowsTable, FormDraftRow>,
          ),
          FormDraftRow,
          PrefetchHooks Function()
        > {
  $$FormDraftRowsTableTableManager(_$AppDatabase db, $FormDraftRowsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$FormDraftRowsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$FormDraftRowsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$FormDraftRowsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> draftKey = const Value.absent(),
                Value<String> ownerUserId = const Value.absent(),
                Value<String> payloadJson = const Value.absent(),
                Value<int> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => FormDraftRowsCompanion(
                draftKey: draftKey,
                ownerUserId: ownerUserId,
                payloadJson: payloadJson,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String draftKey,
                required String ownerUserId,
                required String payloadJson,
                required int updatedAt,
                Value<int> rowid = const Value.absent(),
              }) => FormDraftRowsCompanion.insert(
                draftKey: draftKey,
                ownerUserId: ownerUserId,
                payloadJson: payloadJson,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$FormDraftRowsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $FormDraftRowsTable,
      FormDraftRow,
      $$FormDraftRowsTableFilterComposer,
      $$FormDraftRowsTableOrderingComposer,
      $$FormDraftRowsTableAnnotationComposer,
      $$FormDraftRowsTableCreateCompanionBuilder,
      $$FormDraftRowsTableUpdateCompanionBuilder,
      (
        FormDraftRow,
        BaseReferences<_$AppDatabase, $FormDraftRowsTable, FormDraftRow>,
      ),
      FormDraftRow,
      PrefetchHooks Function()
    >;
typedef $$CounterWorkerRowsTableCreateCompanionBuilder =
    CounterWorkerRowsCompanion Function({
      required String pinHash,
      required String userId,
      required String displayName,
      required String email,
      required String role,
      required String companyId,
      Value<String?> profileId,
      Value<String?> branchId,
      required int enrolledAt,
      Value<int> rowid,
    });
typedef $$CounterWorkerRowsTableUpdateCompanionBuilder =
    CounterWorkerRowsCompanion Function({
      Value<String> pinHash,
      Value<String> userId,
      Value<String> displayName,
      Value<String> email,
      Value<String> role,
      Value<String> companyId,
      Value<String?> profileId,
      Value<String?> branchId,
      Value<int> enrolledAt,
      Value<int> rowid,
    });

class $$CounterWorkerRowsTableFilterComposer
    extends Composer<_$AppDatabase, $CounterWorkerRowsTable> {
  $$CounterWorkerRowsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get pinHash => $composableBuilder(
    column: $table.pinHash,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get displayName => $composableBuilder(
    column: $table.displayName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get email => $composableBuilder(
    column: $table.email,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get role => $composableBuilder(
    column: $table.role,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get companyId => $composableBuilder(
    column: $table.companyId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get profileId => $composableBuilder(
    column: $table.profileId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get enrolledAt => $composableBuilder(
    column: $table.enrolledAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CounterWorkerRowsTableOrderingComposer
    extends Composer<_$AppDatabase, $CounterWorkerRowsTable> {
  $$CounterWorkerRowsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get pinHash => $composableBuilder(
    column: $table.pinHash,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get displayName => $composableBuilder(
    column: $table.displayName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get email => $composableBuilder(
    column: $table.email,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get role => $composableBuilder(
    column: $table.role,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get companyId => $composableBuilder(
    column: $table.companyId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get profileId => $composableBuilder(
    column: $table.profileId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get enrolledAt => $composableBuilder(
    column: $table.enrolledAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CounterWorkerRowsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CounterWorkerRowsTable> {
  $$CounterWorkerRowsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get pinHash =>
      $composableBuilder(column: $table.pinHash, builder: (column) => column);

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get displayName => $composableBuilder(
    column: $table.displayName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get email =>
      $composableBuilder(column: $table.email, builder: (column) => column);

  GeneratedColumn<String> get role =>
      $composableBuilder(column: $table.role, builder: (column) => column);

  GeneratedColumn<String> get companyId =>
      $composableBuilder(column: $table.companyId, builder: (column) => column);

  GeneratedColumn<String> get profileId =>
      $composableBuilder(column: $table.profileId, builder: (column) => column);

  GeneratedColumn<String> get branchId =>
      $composableBuilder(column: $table.branchId, builder: (column) => column);

  GeneratedColumn<int> get enrolledAt => $composableBuilder(
    column: $table.enrolledAt,
    builder: (column) => column,
  );
}

class $$CounterWorkerRowsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CounterWorkerRowsTable,
          CounterWorkerRow,
          $$CounterWorkerRowsTableFilterComposer,
          $$CounterWorkerRowsTableOrderingComposer,
          $$CounterWorkerRowsTableAnnotationComposer,
          $$CounterWorkerRowsTableCreateCompanionBuilder,
          $$CounterWorkerRowsTableUpdateCompanionBuilder,
          (
            CounterWorkerRow,
            BaseReferences<
              _$AppDatabase,
              $CounterWorkerRowsTable,
              CounterWorkerRow
            >,
          ),
          CounterWorkerRow,
          PrefetchHooks Function()
        > {
  $$CounterWorkerRowsTableTableManager(
    _$AppDatabase db,
    $CounterWorkerRowsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CounterWorkerRowsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CounterWorkerRowsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CounterWorkerRowsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> pinHash = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String> displayName = const Value.absent(),
                Value<String> email = const Value.absent(),
                Value<String> role = const Value.absent(),
                Value<String> companyId = const Value.absent(),
                Value<String?> profileId = const Value.absent(),
                Value<String?> branchId = const Value.absent(),
                Value<int> enrolledAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CounterWorkerRowsCompanion(
                pinHash: pinHash,
                userId: userId,
                displayName: displayName,
                email: email,
                role: role,
                companyId: companyId,
                profileId: profileId,
                branchId: branchId,
                enrolledAt: enrolledAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String pinHash,
                required String userId,
                required String displayName,
                required String email,
                required String role,
                required String companyId,
                Value<String?> profileId = const Value.absent(),
                Value<String?> branchId = const Value.absent(),
                required int enrolledAt,
                Value<int> rowid = const Value.absent(),
              }) => CounterWorkerRowsCompanion.insert(
                pinHash: pinHash,
                userId: userId,
                displayName: displayName,
                email: email,
                role: role,
                companyId: companyId,
                profileId: profileId,
                branchId: branchId,
                enrolledAt: enrolledAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CounterWorkerRowsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CounterWorkerRowsTable,
      CounterWorkerRow,
      $$CounterWorkerRowsTableFilterComposer,
      $$CounterWorkerRowsTableOrderingComposer,
      $$CounterWorkerRowsTableAnnotationComposer,
      $$CounterWorkerRowsTableCreateCompanionBuilder,
      $$CounterWorkerRowsTableUpdateCompanionBuilder,
      (
        CounterWorkerRow,
        BaseReferences<
          _$AppDatabase,
          $CounterWorkerRowsTable,
          CounterWorkerRow
        >,
      ),
      CounterWorkerRow,
      PrefetchHooks Function()
    >;
typedef $$DbMetaTableCreateCompanionBuilder =
    DbMetaCompanion Function({
      required String id,
      required String value,
      Value<int> rowid,
    });
typedef $$DbMetaTableUpdateCompanionBuilder =
    DbMetaCompanion Function({
      Value<String> id,
      Value<String> value,
      Value<int> rowid,
    });

class $$DbMetaTableFilterComposer
    extends Composer<_$AppDatabase, $DbMetaTable> {
  $$DbMetaTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get value => $composableBuilder(
    column: $table.value,
    builder: (column) => ColumnFilters(column),
  );
}

class $$DbMetaTableOrderingComposer
    extends Composer<_$AppDatabase, $DbMetaTable> {
  $$DbMetaTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get value => $composableBuilder(
    column: $table.value,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$DbMetaTableAnnotationComposer
    extends Composer<_$AppDatabase, $DbMetaTable> {
  $$DbMetaTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get value =>
      $composableBuilder(column: $table.value, builder: (column) => column);
}

class $$DbMetaTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $DbMetaTable,
          DbMetaData,
          $$DbMetaTableFilterComposer,
          $$DbMetaTableOrderingComposer,
          $$DbMetaTableAnnotationComposer,
          $$DbMetaTableCreateCompanionBuilder,
          $$DbMetaTableUpdateCompanionBuilder,
          (DbMetaData, BaseReferences<_$AppDatabase, $DbMetaTable, DbMetaData>),
          DbMetaData,
          PrefetchHooks Function()
        > {
  $$DbMetaTableTableManager(_$AppDatabase db, $DbMetaTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DbMetaTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DbMetaTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$DbMetaTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> value = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DbMetaCompanion(id: id, value: value, rowid: rowid),
          createCompanionCallback:
              ({
                required String id,
                required String value,
                Value<int> rowid = const Value.absent(),
              }) => DbMetaCompanion.insert(id: id, value: value, rowid: rowid),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$DbMetaTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $DbMetaTable,
      DbMetaData,
      $$DbMetaTableFilterComposer,
      $$DbMetaTableOrderingComposer,
      $$DbMetaTableAnnotationComposer,
      $$DbMetaTableCreateCompanionBuilder,
      $$DbMetaTableUpdateCompanionBuilder,
      (DbMetaData, BaseReferences<_$AppDatabase, $DbMetaTable, DbMetaData>),
      DbMetaData,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$OfflinePendingRowsTableTableManager get offlinePendingRows =>
      $$OfflinePendingRowsTableTableManager(_db, _db.offlinePendingRows);
  $$ListCacheEntriesTableTableManager get listCacheEntries =>
      $$ListCacheEntriesTableTableManager(_db, _db.listCacheEntries);
  $$FormDraftRowsTableTableManager get formDraftRows =>
      $$FormDraftRowsTableTableManager(_db, _db.formDraftRows);
  $$CounterWorkerRowsTableTableManager get counterWorkerRows =>
      $$CounterWorkerRowsTableTableManager(_db, _db.counterWorkerRows);
  $$DbMetaTableTableManager get dbMeta =>
      $$DbMetaTableTableManager(_db, _db.dbMeta);
}
