import { useEffect, useMemo, useState, type ComponentType } from 'react'
import EsfirrasSvg from '../UfoScene'
import { prepareHullBitmaps } from './hullBitmaps'
import { readSceneProfile, supportsWebGL2 } from './profile'
import type { Scene3DProps } from './UfoScene3D'

/* O chunk só é baixado se houver WebGL2. O import fica em cache para o
   StrictMode não disparar duas buscas. */
let scenePromise: Promise<typeof import('./UfoScene3D')> | null = null

function loadScene() {
  scenePromise ??= import('./UfoScene3D')
  return scenePromise
}

type ScenePayload = {
  Scene: ComponentType<Scene3DProps>
  bitmaps: ImageBitmap[]
}

type IdleCapableWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number
  cancelIdleCallback?: (handle: number) => void
}

/* O chunk 3D tem ~900 KB. Baixar e executar isso junto com o primeiro paint
   atrasava o LCP e travava a thread. Agora ele entra somente depois que o
   navegador já pintou a tela e está ocioso, com timeout curto para a cena
   entrar rápido sem competir com o carregamento inicial. */
function whenIdle(task: () => void) {
  const win = window as IdleCapableWindow
  let cancelled = false
  const run = () => {
    if (!cancelled) task()
  }

  /* Só inicia depois do primeiro paint do documento. Se o navegador não
     reportar paint, cai no timeout de 700 ms para não travar para sempre. */
  const start = () => {
    if (win.requestIdleCallback) {
      const handle = win.requestIdleCallback(run, { timeout: 700 })
      return () => {
        cancelled = true
        win.cancelIdleCallback?.(handle)
      }
    }

    const handle = window.setTimeout(run, 700)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }

  if ('requestAnimationFrame' in window) {
    let unsubscribe: (() => void) | undefined
    window.requestAnimationFrame(() => {
      if (cancelled) return
      unsubscribe = start()
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }

  return start()
}

type NetworkInformation = {
  saveData?: boolean
  effectiveType?: string
}

/* Em redes muito ruins / modo economia, a cena 3D custa mais do que entrega:
   ficam as esfirras 2D, o gradiente e as animações CSS. */
function shouldSkip3D() {
  const connection = (
    navigator as Navigator & { connection?: NetworkInformation }
  ).connection

  if (!connection) return false
  if (connection.saveData) return true
  return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g'
}

export default function UfoSceneStage({ paused = false }: { paused?: boolean }) {
  const [payload, setPayload] = useState<ScenePayload | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  /* Começa ativo mesmo se o navegador reportar a aba oculta no primeiro
     frame (headless/bFCache): o primeiro paint da cena não pode ficar parado. */
  const [onScreen, setOnScreen] = useState(true)

  const profile = useMemo(readSceneProfile, [])
  const reduced = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useEffect(() => {
    if (shouldSkip3D()) {
      setFailed(true)
      return
    }

    let cancelled = false
    let probeTimer: number | undefined

    const cancelSchedule = whenIdle(() => {
      const size = profile.lite ? 256 : 512

      /* Dispara downloads/worker primeiro e devolve a task ao navegador.
         O probe de contexto WebGL pode travar dezenas/centenas de ms em
         GPUs por software e não pode segurar o chunk nem a textura. */
      const scene = loadScene()
      const textures = prepareHullBitmaps(size)

      probeTimer = window.setTimeout(() => {
        if (cancelled) return

        if (!supportsWebGL2()) {
          setFailed(true)
          return
        }

        Promise.all([scene, textures])
          .then(([module, bitmaps]) => {
            if (cancelled) return
            setPayload({ Scene: module.default, bitmaps })
          })
          .catch(() => {
            if (!cancelled) setFailed(true)
          })
      }, 0)
    })

    return () => {
      cancelled = true
      window.clearTimeout(probeTimer)
      cancelSchedule()
    }
  }, [profile])

  /* Aba em segundo plano ou tela de entrada escondida: para o loop de render
     em vez de deixá-lo queimando CPU/GPU escondido. */
  useEffect(() => {
    const sync = () => setOnScreen(!document.hidden)
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  const active = onScreen && !paused

  /* O canvas entra no próximo frame depois que o módulo e as texturas estão
     prontos — sem esperar nenhum probe de render. */
  useEffect(() => {
    if (!payload) return
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [payload])

  const Scene3D = payload?.Scene

  const handleFail = () => {
    setReady(false)
    setFailed(true)
  }

  return (
    <div className={`ufo-stage${ready ? ' is-3d' : ''}${failed ? ' is-failed' : ''}`}>
      {Scene3D && payload && !failed && (
        <div className="ufo-stage__canvas" aria-hidden="true">
          <Scene3D
            lite={profile.lite}
            active={active}
            reduced={reduced}
            starCount={profile.starCount}
            hullBitmaps={payload.bitmaps}
            onFail={handleFail}
          />
        </div>
      )}

      <div className="ufo-stage__food" aria-hidden="true">
        <EsfirrasSvg />
      </div>

      {!ready && !failed && <span className="ufo-stage__loading" aria-hidden="true" />}
    </div>
  )
}
