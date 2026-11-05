enum ContactRoleFilter { all, customer, supplier, worker }

class Contact {
  const Contact({
    required this.id,
    required this.name,
    required this.roles,
    required this.phone,
    this.mobile,
    this.email,
    this.address,
    this.city,
    this.balance = 0,
    this.creditLimit,
    this.status = ContactStatus.active,
    this.code,
    this.type,
    this.isSystemGenerated = false,
  });

  final String id;
  final String name;
  final List<ContactRoleFilter> roles;
  final String phone;
  final String? mobile;
  final String? email;
  final String? address;
  final String? city;
  final double balance;
  final double? creditLimit;
  final ContactStatus status;
  final String? code;
  final String? type;
  final bool isSystemGenerated;

  String get displayPhone {
    if (phone.trim().isNotEmpty) return phone.trim();
    return (mobile ?? '').trim();
  }

  String get displayRef {
    if (code != null && code!.trim().isNotEmpty) return code!.trim();
    return '';
  }
}

enum ContactStatus { active, inactive }
