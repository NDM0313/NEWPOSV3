import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../app/config/app_config.dart';
import '../../../core/auth/functional_roles.dart';
import '../../../data/models/branch.dart';
import '../../../data/models/module_toggles.dart';
import '../../../data/models/user_profile.dart';
import 'permission_state.dart';
import 'repository_providers.dart';

enum AuthStatus {
  unknown,
  unauthenticated,
  loading,
  needsBranch,
  authenticated,
  error,
}

class AuthSessionState {
  const AuthSessionState({
    required this.status,
    this.profile,
    this.selectedBranch,
    this.availableBranches = const [],
    this.permissions = PermissionState.initial,
    this.errorMessage,
  });

  final AuthStatus status;
  final UserProfile? profile;
  final Branch? selectedBranch;
  final List<Branch> availableBranches;
  final PermissionState permissions;
  final String? errorMessage;

  static const initial = AuthSessionState(status: AuthStatus.unknown);

  AuthSessionState copyWith({
    AuthStatus? status,
    UserProfile? profile,
    Branch? selectedBranch,
    List<Branch>? availableBranches,
    PermissionState? permissions,
    String? errorMessage,
    bool clearBranch = false,
    bool clearProfile = false,
  }) {
    return AuthSessionState(
      status: status ?? this.status,
      profile: clearProfile ? null : (profile ?? this.profile),
      selectedBranch: clearBranch ? null : (selectedBranch ?? this.selectedBranch),
      availableBranches: availableBranches ?? this.availableBranches,
      permissions: permissions ?? this.permissions,
      errorMessage: errorMessage,
    );
  }
}

class AuthSessionNotifier extends Notifier<AuthSessionState> {
  static const _storage = FlutterSecureStorage();

  @override
  AuthSessionState build() {
    return AuthSessionState.initial;
  }

  Future<void> bootstrap() async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    final authRepo = ref.read(authRepositoryProvider);

    if (!authRepo.isConfigured) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: AppConfig.configurationErrorMessage,
      );
      return;
    }

    try {
      final profile = await authRepo.restoreSession();
      if (profile == null) {
        state = AuthSessionState(status: AuthStatus.unauthenticated);
        return;
      }
      await _hydrateAfterProfile(profile);
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: authRepo.formatSignInError(e),
      );
    }
  }

  Future<void> signIn(String email, String password) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    final authRepo = ref.read(authRepositoryProvider);
    try {
      final profile = await authRepo.signInWithPassword(email, password);
      await _hydrateAfterProfile(profile);
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        errorMessage: authRepo.formatSignInError(e),
      );
    }
  }

  Future<void> signOut() async {
    await ref.read(authRepositoryProvider).signOut();
    await _storage.delete(key: AppConfig.branchStorageKey);
    state = AuthSessionState(status: AuthStatus.unauthenticated);
  }

  Future<void> selectBranch(Branch branch) async {
    if (!state.permissions.hasBranchAccess(branch.id) &&
        !state.permissions.isAdminOrOwner) {
      state = state.copyWith(
        errorMessage: 'You do not have access to this branch.',
      );
      return;
    }
    await _storage.write(key: AppConfig.branchStorageKey, value: branch.id);
    state = state.copyWith(
      selectedBranch: branch,
      status: AuthStatus.authenticated,
      errorMessage: null,
    );
  }

  Future<void> _hydrateAfterProfile(UserProfile profile) async {
    final branchRepo = ref.read(branchRepositoryProvider);
    final permRepo = ref.read(permissionRepositoryProvider);
    final settingsRepo = ref.read(settingsRepositoryProvider);

    final permissions = await permRepo.getRolePermissions(profile.role);
    final branchAccess = await branchRepo.getUserAccessibleBranches(
      authUserId: profile.authUserId,
      profileId: profile.profileId,
      companyId: profile.companyId,
      appRole: profile.role,
    );

    ModuleConfigStatus moduleStatus;
    ModuleToggles toggles;
    if (profile.companyId == null) {
      moduleStatus = ModuleConfigStatus.noCompany;
      toggles = ModuleToggles.failClosed;
    } else {
      final moduleRes = await settingsRepo.getModuleConfigs(profile.companyId);
      toggles = moduleRes.error != null
          ? ModuleToggles.failClosed
          : moduleRes.toggles;
      moduleStatus = moduleRes.error != null
          ? ModuleConfigStatus.loadError
          : ModuleConfigStatus.ok;
    }

    final isAdminOrOwner = isAdminOrOwnerAppRole(profile.role);
    final isOwner = normalizeAppRole(profile.role) == 'owner';

    final permState = PermissionState(
      permissions: permissions,
      branchIds: branchAccess.branchIds,
      moduleToggles: toggles,
      moduleConfigStatus: moduleStatus,
      isLoaded: true,
      isAdminOrOwner: isAdminOrOwner,
      isOwner: isOwner,
      canViewBalances: canViewFinancialBalances(profile.role),
      moduleConfigBanner: PermissionState.buildModuleConfigBanner(
        moduleStatus,
        toggles,
        isAdminOrOwner,
      ),
    );

    List<Branch> branches = [];
    if (profile.companyId != null) {
      if (isAdminOrOwner) {
        branches = await branchRepo.getBranches(profile.companyId!);
      } else if (branchAccess.branchIds.isNotEmpty) {
        final all = await branchRepo.getBranches(profile.companyId!);
        branches = all
            .where((b) => branchAccess.branchIds.contains(b.id))
            .toList();
      } else {
        branches = await branchRepo.getBranches(profile.companyId!);
      }
    }

    Branch? selected;
    final storedId = await _storage.read(key: AppConfig.branchStorageKey);
    if (storedId != null) {
      for (final b in branches) {
        if (b.id == storedId) {
          selected = b;
          break;
        }
      }
    }
    if (selected == null && branchAccess.effectiveBranchId != null) {
      for (final b in branches) {
        if (b.id == branchAccess.effectiveBranchId) {
          selected = b;
          break;
        }
      }
    }
    if (selected == null && branches.length == 1) {
      selected = branches.first;
    }

    final needsBranch =
        selected == null &&
        (branchAccess.requiresBranchSelection || branches.length > 1);

    if (selected != null) {
      await _storage.write(key: AppConfig.branchStorageKey, value: selected.id);
    }

    state = AuthSessionState(
      status: needsBranch ? AuthStatus.needsBranch : AuthStatus.authenticated,
      profile: profile,
      selectedBranch: selected,
      availableBranches: branches,
      permissions: permState,
    );
  }
}

final authSessionProvider =
    NotifierProvider<AuthSessionNotifier, AuthSessionState>(
  AuthSessionNotifier.new,
);
