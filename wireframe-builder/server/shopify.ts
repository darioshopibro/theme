import fs from "fs";
import path from "path";

const ENV_FILE = path.join(process.cwd(), ".env");

interface ShopifyConfig {
  storeUrl: string;
  accessToken: string;
  apiVersion: string;
}

function loadEnv(): Record<string, string> {
  if (!fs.existsSync(ENV_FILE)) return {};
  const content = fs.readFileSync(ENV_FILE, "utf-8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
  return env;
}

function saveEnv(vars: Record<string, string>) {
  const existing = loadEnv();
  const merged = { ...existing, ...vars };
  const content = Object.entries(merged)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  fs.writeFileSync(ENV_FILE, content + "\n", "utf-8");
}

export function getConfig(): ShopifyConfig | null {
  const env = loadEnv();
  const storeUrl = env.SHOPIFY_STORE_URL;
  const accessToken = env.SHOPIFY_ACCESS_TOKEN;
  if (!storeUrl || !accessToken) return null;
  return { storeUrl, accessToken, apiVersion: "2024-01" };
}

export function saveConfig(storeUrl: string, accessToken: string) {
  saveEnv({
    SHOPIFY_STORE_URL: storeUrl,
    SHOPIFY_ACCESS_TOKEN: accessToken,
  });
}

export async function shopifyFetch(
  endpoint: string,
  method: "GET" | "PUT" | "POST" | "DELETE" = "GET",
  body?: any
): Promise<any> {
  const config = getConfig();
  if (!config) throw new Error("Shopify not connected");

  const url = `https://${config.storeUrl}/admin/api/${config.apiVersion}/${endpoint}`;
  const headers: Record<string, string> = {
    "X-Shopify-Access-Token": config.accessToken,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API ${res.status}: ${text}`);
  }

  return res.json();
}

// Get shop info (used to validate connection)
export async function getShopInfo() {
  const data = await shopifyFetch("shop.json");
  return data.shop;
}

// List all themes
export async function getThemes() {
  const data = await shopifyFetch("themes.json");
  return data.themes as {
    id: number;
    name: string;
    role: string;
    created_at: string;
    updated_at: string;
  }[];
}

// Get the active (main) theme
export async function getActiveTheme() {
  const themes = await getThemes();
  return themes.find((t) => t.role === "main") || null;
}

// Read a theme asset
export async function getThemeAsset(themeId: number, key: string) {
  const data = await shopifyFetch(
    `themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`
  );
  return data.asset;
}

// Write/update a theme asset
export async function putThemeAsset(
  themeId: number,
  key: string,
  value: string
) {
  const data = await shopifyFetch(`themes/${themeId}/assets.json`, "PUT", {
    asset: { key, value },
  });
  return data.asset;
}

// List all assets in a theme
export async function listThemeAssets(themeId: number) {
  const data = await shopifyFetch(`themes/${themeId}/assets.json`);
  return data.assets as { key: string; content_type: string; updated_at: string }[];
}

// Read a template JSON file (e.g., templates/index.json)
export async function getTemplateJson(themeId: number, templateName: string) {
  const key = `templates/${templateName}.json`;
  const asset = await getThemeAsset(themeId, key);
  return JSON.parse(asset.value);
}

// Write a template JSON file
export async function putTemplateJson(
  themeId: number,
  templateName: string,
  data: any
) {
  const key = `templates/${templateName}.json`;
  return putThemeAsset(themeId, key, JSON.stringify(data, null, 2));
}

// List section files
export async function listSections(themeId: number) {
  const assets = await listThemeAssets(themeId);
  return assets
    .filter((a) => a.key.startsWith("sections/") && a.key.endsWith(".liquid"))
    .map((a) => ({
      key: a.key,
      name: a.key.replace("sections/", "").replace(".liquid", ""),
      updatedAt: a.updated_at,
    }));
}

// Get products (for preview URL)
export async function getProducts(limit = 1) {
  const data = await shopifyFetch(`products.json?limit=${limit}&status=active`);
  return data.products;
}

// Get collections (for preview URL)
export async function getCollections(limit = 1) {
  const data = await shopifyFetch(`custom_collections.json?limit=${limit}`);
  return data.custom_collections;
}

// ══════════════════════════════════════════════════════════
// ── CMS: Push changes to Shopify theme ──
// ══════════════════════════════════════════════════════════

// Push theme settings (colors, fonts, spacing, etc.)
export async function pushSettings(
  themeId: number,
  settings: Record<string, any>
) {
  // Read current settings_data.json
  const asset = await getThemeAsset(themeId, "config/settings_data.json");
  const settingsData = JSON.parse(asset.value);

  // Merge our settings into current
  if (!settingsData.current) settingsData.current = {};
  Object.assign(settingsData.current, settings);

  // Write back
  await putThemeAsset(
    themeId,
    "config/settings_data.json",
    JSON.stringify(settingsData, null, 2)
  );
  return settingsData.current;
}

// Push section order for a page
export async function pushSectionOrder(
  themeId: number,
  page: string, // "index", "collection", "product"
  order: string[] // array of section keys in new order
) {
  const template = await getTemplateJson(themeId, page);
  template.order = order;
  await putTemplateJson(themeId, page, template);
  return template;
}

// Add a section to a page template
export async function addSectionToTemplate(
  themeId: number,
  page: string,
  sectionKey: string,
  sectionType: string,
  sectionSettings: Record<string, any> = {},
  position?: number // index in order array, defaults to end
) {
  const template = await getTemplateJson(themeId, page);

  // Add to sections object
  template.sections[sectionKey] = {
    type: sectionType,
    settings: sectionSettings,
  };

  // Add to order array
  if (!template.order) template.order = [];
  if (position !== undefined && position >= 0) {
    template.order.splice(position, 0, sectionKey);
  } else {
    template.order.push(sectionKey);
  }

  await putTemplateJson(themeId, page, template);
  return template;
}

// Remove a section from a page template
export async function removeSectionFromTemplate(
  themeId: number,
  page: string,
  sectionKey: string
) {
  const template = await getTemplateJson(themeId, page);

  // Remove from sections object
  delete template.sections[sectionKey];

  // Remove from order array
  template.order = (template.order || []).filter(
    (k: string) => k !== sectionKey
  );

  await putTemplateJson(themeId, page, template);
  return template;
}

// Update a section's settings
export async function updateSectionSettings(
  themeId: number,
  page: string,
  sectionKey: string,
  settings: Record<string, any>
) {
  const template = await getTemplateJson(themeId, page);

  if (template.sections[sectionKey]) {
    template.sections[sectionKey].settings = {
      ...template.sections[sectionKey].settings,
      ...settings,
    };
  }

  await putTemplateJson(themeId, page, template);
  return template;
}

// Get storefront password from env
export function getStorefrontPassword(): string | null {
  const env = loadEnv();
  return env.SHOPIFY_STOREFRONT_PASSWORD || null;
}

// Fetch a page from storefront with password cookie (for Section Rendering API)
export async function storefrontFetch(
  path: string,
  params?: Record<string, string>
): Promise<string> {
  const config = getConfig();
  if (!config) throw new Error("Shopify not connected");

  const url = new URL(`https://${config.storeUrl}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  // Handle password-protected stores
  const password = getStorefrontPassword();
  const headers: Record<string, string> = {};
  if (password) {
    // First get the password cookie
    const pwRes = await fetch(`https://${config.storeUrl}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `password=${encodeURIComponent(password)}`,
      redirect: "manual",
    });
    const cookies = pwRes.headers.getSetCookie?.() || [];
    if (cookies.length > 0) {
      headers["Cookie"] = cookies.map((c) => c.split(";")[0]).join("; ");
    }
  }

  const res = await fetch(url.toString(), { headers });
  return res.text();
}
