# Settings architecture

## Permissions
| Permission | ADMINISTRATOR | MANAGER | CASHIER | KITCHEN |
|------------|---------------|---------|---------|---------|
| settings:read | * | Y | N | N |
| settings:write | * | Y | N | N |
| users:write | * | N | N | N |

## Endpoints
| Method | Path | Permission |
|--------|------|------------|
| GET | /meta | authenticated |
| PUT | /settings/vat | settings:write |
| POST | /users | users:write |
| POST | /users/:id/status | users:write |

## VAT
Creates a new `VatSetting` row with `effective_from` — does not mutate history.

## Users
Admin-created accounts (controlled onboarding). scrypt password hashes. Cannot deactivate self. Only admin creates other admins.
