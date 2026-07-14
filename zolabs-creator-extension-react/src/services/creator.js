function isZohoReady() {
  return Boolean(window.ZOHO?.CREATOR);
}

export async function getCreatorContext() {
  if (!isZohoReady()) {
    return {
      available: false,
      appLinkName: "demo_app",
      appDisplayName: "Demo Creator App",
      accountOwnerName: "",
      userEmail: "demo@example.org"
    };
  }

  const params = await window.ZOHO.CREATOR.UTIL.getInitParams();
  const environmentMatch = /\/environment\/(development|stage)/i.exec(
    params?.envUrlFragment || ""
  );

  /*
   * Confirmed against Zoho's official getInitParams() docs — the real
   * response shape is only:
   *   { scope, envUrlFragment, appLinkName, loginUser }
   * There is no accountOwnerName / appOwner field. "scope" is Zoho's own
   * workspace/account identifier (e.g. "zylkercorp" in
   * creator.zoho.com/zylkercorp/widgetapp) — that is the value the
   * Creator Data API v2.1 needs as the owner-name path segment.
   */
  return {
    available: true,
    appLinkName: params?.appLinkName || "",
    appDisplayName: params?.appLinkName || "",
    accountOwnerName: params?.scope || "",
    creatorEnvironment: environmentMatch?.[1]?.toLowerCase() || "production",
    userEmail: params?.loginUser || ""
  };
}

export async function getCreatorForms(appLinkName) {
  if (!isZohoReady()) {
    return [];
  }

  const response = await window.ZOHO.CREATOR.META.getForms({
    app_name: appLinkName
  });

  return response?.forms || response?.data?.forms || response?.data || [];
}

export async function getCreatorFields(appLinkName, formLinkName) {
  if (!isZohoReady()) {
    return [];
  }

  const response = await window.ZOHO.CREATOR.META.getFields({
    app_name: appLinkName,
    form_name: formLinkName
  });

  return response?.fields || response?.data?.fields || response?.data || [];
}

export async function createCreatorRecord(appLinkName, formLinkName, data) {
  if (!isZohoReady()) {
    return { code: 3000, data: { ID: "DEMO-RECORD-001" } };
  }

  return window.ZOHO.CREATOR.DATA.addRecords({
    app_name: appLinkName,
    form_name: formLinkName,
    payload: { data }
  });
}
