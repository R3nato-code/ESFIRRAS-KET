/* Este módulo NÃO importa three: ele é chamado pelo chunk principal logo
   depois do primeiro paint. Só as imagens (ImageBitmap) são geradas aqui —
   o chunk 3D, quando chega, converte tudo em Textures. Assim o three não
   entra no bundle crítico. */

let request: { size: number; promise: Promise<ImageBitmap[]> } | undefined

export function prepareHullBitmaps(size = 512): Promise<ImageBitmap[]> {
  if (request?.size === size) return request.promise

  const promise = buildHullBitmaps(size)
  request = { size, promise }
  return promise
}

async function buildHullBitmaps(size: number): Promise<ImageBitmap[]> {
  if (
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof createImageBitmap !== 'undefined'
  ) {
    try {
      return await paintInWorker(size)
    } catch {
      /* Worker bloqueado/indisponível: pinta no main thread mesmo. */
    }
  }

  return paintOnMainThread(size)
}

function paintInWorker(size: number): Promise<ImageBitmap[]> {
  return new Promise((resolve, reject) => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./hull.worker.ts', import.meta.url), {
        type: 'module',
      })
    } catch (error) {
      reject(error)
      return
    }

    let timer: number | undefined
    const stop = () => {
      if (timer !== undefined) window.clearTimeout(timer)
      worker.terminate()
    }

    worker.addEventListener(
      'message',
      (event: MessageEvent<{ images?: ImageBitmap[]; error?: string }>) => {
        stop()
        const images = event.data?.images
        if (images?.length === 3) resolve(images)
        else reject(new Error(event.data?.error ?? 'Texturas indisponíveis'))
      },
      { once: true },
    )

    worker.addEventListener(
      'error',
      () => {
        stop()
        reject(new Error('Worker de texturas falhou'))
      },
      { once: true },
    )

    /* Nunca deixa a cena presa esperando o worker. */
    timer = window.setTimeout(() => {
      stop()
      reject(new Error('Timeout ao gerar texturas'))
    }, 4000)

    worker.postMessage({ size })
  })
}

async function paintOnMainThread(size: number): Promise<ImageBitmap[]> {
  /* Só browsers sem OffscreenCanvas worker chegam aqui: o import dinâmico
     mantém o pintor fora do bundle crítico. */
  const { paintHull } = await import('./paintHull')

  const canvases = Array.from({ length: 3 }, () => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D indisponível')
    return { canvas, context }
  })

  paintHull(
    size,
    canvases[0].context,
    canvases[1].context,
    canvases[2].context,
  )

  /* flipY alinha o ImageBitmap ao comportamento padrão de uma Texture
     (o WebGLRenderer ignora UNPACK_FLIP_Y para bitmaps). */
  const options: ImageBitmapOptions = {
    imageOrientation: 'flipY',
    premultiplyAlpha: 'none',
  }

  return Promise.all(
    canvases.map(({ canvas }) => createImageBitmap(canvas, options)),
  )
}
