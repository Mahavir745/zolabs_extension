function isZohoReady() {
  return Boolean(window.ZOHO?.CREATOR);
}

export async function getCreatorContext() {
  if (!isZohoReady()) {
    return {
      available: false,
      appLinkName: "demo_app",
      appDisplayName: "Demo Creator App",
      userEmail: "demo@example.org"
    };
  }

  const params = await window.ZOHO.CREATOR.UTIL.getInitParams();
  return {
    available: true,
    appLinkName: params?.appLinkName || params?.app_link_name || "",
    appDisplayName: params?.appName || params?.app_name || "",
    userEmail: params?.loginUser || params?.login_user || ""
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
