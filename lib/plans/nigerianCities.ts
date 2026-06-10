/** Nigerian cities for Platinum multi-city group plans. */
export const NIGERIAN_CITIES = [
  { id: 'lagos', label: 'Lagos', state: 'Lagos' },
  { id: 'abuja', label: 'Abuja', state: 'FCT' },
  { id: 'ph', label: 'Port Harcourt', state: 'Rivers' },
  { id: 'kano', label: 'Kano', state: 'Kano' },
  { id: 'ibadan', label: 'Ibadan', state: 'Oyo' },
  { id: 'benin', label: 'Benin City', state: 'Edo' },
  { id: 'kaduna', label: 'Kaduna', state: 'Kaduna' },
  { id: 'enugu', label: 'Enugu', state: 'Enugu' },
  { id: 'aba', label: 'Aba', state: 'Abia' },
  { id: 'jos', label: 'Jos', state: 'Plateau' },
  { id: 'ilorin', label: 'Ilorin', state: 'Kwara' },
  { id: 'warri', label: 'Warri', state: 'Delta' },
  { id: 'calabar', label: 'Calabar', state: 'Cross River' },
  { id: 'abeokuta', label: 'Abeokuta', state: 'Ogun' },
  { id: 'onitsha', label: 'Onitsha', state: 'Anambra' },
  { id: 'uyo', label: 'Uyo', state: 'Akwa Ibom' },
  { id: 'maiduguri', label: 'Maiduguri', state: 'Borno' },
  { id: 'zaria', label: 'Zaria', state: 'Kaduna' },
  { id: 'owerri', label: 'Owerri', state: 'Imo' },
  { id: 'akure', label: 'Akure', state: 'Ondo' },
  { id: 'bauchi', label: 'Bauchi', state: 'Bauchi' },
  { id: 'sokoto', label: 'Sokoto', state: 'Sokoto' },
  { id: 'makurdi', label: 'Makurdi', state: 'Benue' },
  { id: 'minna', label: 'Minna', state: 'Niger' },
  { id: 'ado-ekiti', label: 'Ado-Ekiti', state: 'Ekiti' },
  { id: 'yenagoa', label: 'Yenagoa', state: 'Bayelsa' },
  { id: 'lokoja', label: 'Lokoja', state: 'Kogi' },
  { id: 'asaba', label: 'Asaba', state: 'Delta' },
  { id: 'gusau', label: 'Gusau', state: 'Zamfara' },
  { id: 'jalingo', label: 'Jalingo', state: 'Taraba' },
] as const;

export type NigerianCityId = (typeof NIGERIAN_CITIES)[number]['id'];

export const MULTI_CITY_MIN = 2;
export const MULTI_CITY_MAX = 5;

const cityById = new Map(NIGERIAN_CITIES.map((c) => [c.id, c]));

export function cityLabelById(id: string): string {
  return cityById.get(id as NigerianCityId)?.label ?? id;
}

export function filterCitiesForPicker(
  query: string,
  selectedIds: string[]
): typeof NIGERIAN_CITIES[number][] {
  const q = query.trim().toLowerCase();
  return NIGERIAN_CITIES.filter((c) => {
    if (!q) return !selectedIds.includes(c.id);
    if (selectedIds.includes(c.id)) return false;
    return (
      c.label.toLowerCase().includes(q) ||
      c.state.toLowerCase().includes(q) ||
      c.id.replace(/-/g, ' ').includes(q)
    );
  });
}
