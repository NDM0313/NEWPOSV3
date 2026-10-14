import 'package:supabase_flutter/supabase_flutter.dart' hide AuthException;

import '../../app/config/app_config.dart';
import '../../core/auth/functional_roles.dart';
import '../../core/supabase/supabase_bootstrap.dart';
import '../models/user_profile.dart';

class ErpAuthException implements Exception {
  ErpAuthException(this.message);
  final String message;
  @override
  String toString() => message;
}

class AuthRepository {
  SupabaseClient get _client => SupabaseBootstrap.client;

  bool get isConfigured => AppConfig.isConfigured && SupabaseBootstrap.isReady;

  Future<Session?> currentSession() async {
    if (!isConfigured) return null;
    return _client.auth.currentSession;
  }

  Future<UserProfile> loadProfileForAuthUser(User user) async {
    final row = await _client
        .from('users')
        .select('id, company_id, role, full_name, email, is_active')
        .or('id.eq.${user.id},auth_user_id.eq.${user.id}')
        .maybeSingle();

    if (row == null) {
      throw ErpAuthException(
        'User profile not found. Complete setup in web ERP.',
      );
    }

    if (row['is_active'] == false) {
      throw ErpAuthException(
        'Your account is inactive. Contact your administrator.',
      );
    }

    final fullName = (row['full_name'] as String?)?.trim();
    final email = user.email ?? (row['email'] as String?) ?? '';
    final displayName = fullName?.isNotEmpty == true
        ? fullName!
        : (email.isNotEmpty ? email.split('@').first : 'User');

    return UserProfile(
      authUserId: user.id,
      name: displayName,
      email: email,
      role: normalizeAppRole(row['role'] as String?),
      companyId: row['company_id'] as String?,
      profileId: row['id'] as String?,
    );
  }

  Future<UserProfile> signInWithPassword(String email, String password) async {
    if (!isConfigured) {
      throw ErpAuthException(AppConfig.configurationErrorMessage);
    }

    final response = await _client.auth.signInWithPassword(
      email: email.trim(),
      password: password,
    );

    final user = response.user;
    if (user == null) {
      throw ErpAuthException('Login failed.');
    }

    return loadProfileForAuthUser(user);
  }

  Future<UserProfile?> restoreSession() async {
    if (!isConfigured) return null;

    final session = _client.auth.currentSession;
    if (session == null) return null;

    final user = session.user;
    try {
      return await loadProfileForAuthUser(user);
    } on ErpAuthException {
      await signOut();
      return null;
    }
  }

  Future<void> signOut() async {
    if (!isConfigured) return;
    await _client.auth.signOut();
  }

  String formatSignInError(Object error) {
    if (error is ErpAuthException) {
      final msg = error.message.toLowerCase();
      if (msg.contains('invalid login credentials')) {
        return 'Invalid email or password.';
      }
      if (msg.contains('email not confirmed')) {
        return 'Please confirm your email first.';
      }
      return error.message;
    }
    final msg = error.toString().toLowerCase();
    if (msg.contains('failed to fetch') || msg.contains('network')) {
      return 'Cannot reach the server. Check network or contact admin.';
    }
    return error.toString();
  }
}
