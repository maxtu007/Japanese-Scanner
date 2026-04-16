import { Purchases } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

const RC_API_KEY = 'test_qpIvPPPqybGFCxfFDEXGSbWUEni';

export function isNative() {
  return Capacitor.isNativePlatform();
}

export async function initPurchases() {
  if (!isNative()) return;
  try {
    await Purchases.configureWith({ apiKey: RC_API_KEY });
  } catch (e) {
    console.error('[RC] configure failed:', e);
  }
}

export async function getOffering() {
  if (!isNative()) return null;
  try {
    const { offerings } = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (e) {
    console.error('[RC] getOfferings failed:', e);
    return null;
  }
}

export async function purchasePackage(pkg) {
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
  return customerInfo.entitlements.active['premium'] != null;
}

export async function restorePurchases() {
  const { customerInfo } = await Purchases.restorePurchases();
  return customerInfo.entitlements.active['premium'] != null;
}

export async function checkEntitlement() {
  if (!isNative()) return false;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active['premium'] != null;
  } catch (e) {
    return false;
  }
}
