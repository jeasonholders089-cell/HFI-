export const CATEGORIES = ['人文科学','社会科学','自然科学','艺术'] as const;
export function categorized(raw: string | null) {
 try {const ds=JSON.parse(raw||'[]');return Array.isArray(ds)&&ds.length===3&&ds.every((d:{category?:string})=>CATEGORIES.includes(d.category as typeof CATEGORIES[number]));}catch{return false;}
}
