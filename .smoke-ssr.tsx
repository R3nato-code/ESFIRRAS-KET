import { renderToStaticMarkup } from 'react-dom/server'
import OrderSection from './src/components/OrderSection'

const html = renderToStaticMarkup(<OrderSection />)
console.log(html)
