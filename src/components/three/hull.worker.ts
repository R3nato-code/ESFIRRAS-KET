import { paintHull } from './paintHull'

type Request = { size?: number }
type Response = { images?: ImageBitmap[]; error?: string }

/* Tipagem mínima do escopo do worker: o tsconfig usa lib DOM (não webworker),
   então evitamos depender de DedicatedWorkerGlobalScope. */
const scope = self as unknown as {
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<Request>) => void,
  ) => void
  postMessage: (message: Response, transfer?: Transferable[]) => void
}

function makeCanvas(size: number) {
  const canvas = new OffscreenCanvas(size, size)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D indisponível no worker')
  return { canvas, context }
}

scope.addEventListener('message', async (event) => {
  try {
    const size = Math.min(1024, Math.max(64, Math.round(event.data?.size ?? 512)))
    const color = makeCanvas(size)
    const bump = makeCanvas(size)
    const rough = makeCanvas(size)

    paintHull(size, color.context, bump.context, rough.context)

    /* flipY alinha o ImageBitmap ao comportamento padrão de uma Texture
       (o WebGLRenderer ignora UNPACK_FLIP_Y para bitmaps). */
    const options: ImageBitmapOptions = {
      imageOrientation: 'flipY',
      premultiplyAlpha: 'none',
    }

    const images = await Promise.all([
      createImageBitmap(color.canvas, options),
      createImageBitmap(bump.canvas, options),
      createImageBitmap(rough.canvas, options),
    ])

    scope.postMessage({ images }, images)
  } catch (error) {
    scope.postMessage({
      error: error instanceof Error ? error.message : String(error),
    })
  }
})
