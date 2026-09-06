type CustomerContact = {
  email?: string | null;
  phone?: string | null;
};

export const normaliseEmail = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase();
export const normalisePhone = (value: unknown) => String(value ?? '').replace(/[^0-9]/g, '');

export function matchesCustomer(customer: CustomerContact, contact: CustomerContact) {
  const email = normaliseEmail(contact.email);
  const phone = normalisePhone(contact.phone);

  return (
    (email.length > 0 && normaliseEmail(customer.email) === email) ||
    (phone.length >= 7 && normalisePhone(customer.phone) === phone)
  );
}
