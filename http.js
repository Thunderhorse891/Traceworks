export const BUSINESS_EMAIL = 'traceworks.tx@outlook.com';

export function getBusinessEmail() {
  return process.env.OWNER_EMAIL || BUSINESS_EMAIL;
}
