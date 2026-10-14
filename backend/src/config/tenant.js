const brands = {
    nexford: { name: "Nexford Market" },
    trade4worldfx: { name: "Trade4WorldFX" }
};

export function tenantBrand(tenantId) {
    return brands[tenantId] || { name: "Trading Portal" };
}
