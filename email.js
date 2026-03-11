export const PACKAGES = {
  locate: {
    id: "locate",
    name: "Skip Trace & Locate",
    amount: 7500,
    currency: "usd",
    deliveryHours: 24,
    sections: [
      "Identity and Address Verification",
      "Phone and Contact Surface",
      "Public Records Cross-Reference",
      "Risk Flags and Service Notes"
    ]
  },
  comprehensive: {
    id: "comprehensive",
    name: "Comprehensive Locate + Assets",
    amount: 15000,
    currency: "usd",
    deliveryHours: 48,
    sections: [
      "Identity and Address Verification",
      "Asset and Property Search",
      "Employment and Business Signals",
      "Social and Alias Cross-Reference",
      "Action Plan for Legal Follow-up"
    ]
  },
  title: {
    id: "title",
    name: "Property & Title Research",
    amount: 20000,
    currency: "usd",
    deliveryHours: 48,
    sections: [
      "Chain of Title Timeline",
      "Lien and Encumbrance Review",
      "Quitclaim and Transfer Pattern Review",
      "Mineral and Water Rights Notes",
      "County Filing Summary"
    ]
  },
  heir: {
    id: "heir",
    name: "Heir & Beneficiary Locate",
    amount: 10000,
    currency: "usd",
    deliveryHours: 72,
    sections: [
      "Kinship and Household Mapping",
      "Obituary and Probate Cross-Reference",
      "Beneficiary Lead Prioritization",
      "Contactability Assessment"
    ]
  }
};

export function getPackage(packageId) {
  return PACKAGES[packageId] ?? null;
}
