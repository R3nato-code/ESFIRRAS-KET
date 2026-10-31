export type MenuCategory = 'salgadas' | 'doces'

export type MenuItem = {
  id: string
  name: string
  category: MenuCategory
  description: string
  image: string
  width: number
  height: number
  accent: string
  preco: number // valor em centavos (ex: 500 = R$ 5,00)
}

export const menu: MenuItem[] = [
  {
    id: 'carne',
    name: 'Carne',
    category: 'salgadas',
    description: 'Carne moída bem temperada, com cheiro-verde e o toque da casa.',
    image: '/menu/carne.webp',
    width: 347,
    height: 235,
    accent: '#ff7a1a',
    preco: 500,
  },
  {
    id: 'carne-com-queijo',
    name: 'Carne com queijo',
    category: 'salgadas',
    description: 'A carne da casa coberta por uma camada generosa de muçarela derretida.',
    image: '/menu/carne-queijo.webp',
    width: 351,
    height: 227,
    accent: '#ffc94a',
    preco: 500,
  },
  {
    id: 'chocolate-com-mm',
    name: 'Chocolate com MM',
    category: 'doces',
    description: 'Chocolate cremoso com confeitos coloridos por cima. Puro caos do bem.',
    image: '/menu/chocolate-mm.webp',
    width: 311,
    height: 199,
    accent: '#ff6b8a',
    preco: 600,
  },
  {
    id: 'chocolate-com-granulado',
    name: 'Chocolate com granulado',
    category: 'doces',
    description: 'Chocolate ao leite com granulado de verdade, do jeito clássico.',
    image: '/menu/chocolate-granulado.webp',
    width: 304,
    height: 213,
    accent: '#d98a5a',
    preco: 600,
  },
  {
    id: 'prestigio',
    name: 'Prestígio',
    category: 'doces',
    description: 'Chocolate com coco ralado. O clássico que sempre salva o dia.',
    image: '/menu/prestigio.webp',
    width: 295,
    height: 222,
    accent: '#f2e2b6',
    preco: 600,
  },
]

export const categoryLabels: Record<MenuCategory, string> = {
  salgadas: 'Salgada',
  doces: 'Doce',
}
