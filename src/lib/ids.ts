export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function newTaskId(room: string, title: string): string {
  const base = slugify(`${room}-${title}`) || 'tarea'
  const rand = Math.random().toString(36).slice(2, 6)
  return `custom-${base}-${rand}`
}
