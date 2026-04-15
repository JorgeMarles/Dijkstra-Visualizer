import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '@xyflow/react/dist/style.css';
import './App.css'
import CustomFlow from './components/CustomFlow'
import type { DijkstraRow, EdgeInfo, FrontierEdge, NodeInfo } from './service/Graph.ts'

function App() {
  const initialWidth = 600;
  const [panelWidth, setPanelWidth] = useState(initialWidth)
  const [isResizing, setIsResizing] = useState(false)
  const [nodesInfo, setNodesInfo] = useState<NodeInfo[]>([])
  const [edgesInfo, setEdgesInfo] = useState<EdgeInfo[]>([])
  const [clearSignal, setClearSignal] = useState(0)
  const [startRequestNonce, setStartRequestNonce] = useState(0)
  const [stepSignal, setStepSignal] = useState(0)
  const [randomRequestNonce, setRandomRequestNonce] = useState(0)
  const [randomN, setRandomN] = useState(6)
  const [randomM, setRandomM] = useState(8)
  const [selectedStartId, setSelectedStartId] = useState<number | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null)
  const [dijkstraRows, setDijkstraRows] = useState<DijkstraRow[]>([])
  const [frontierEdges, setFrontierEdges] = useState<FrontierEdge[]>([])
  const [dijkstraMeta, setDijkstraMeta] = useState({
    running: false,
    finished: false,
    startId: null as number | null,
    targetId: null as number | null,
    message: 'Sin ejecucion activa',
  })
  const [simulationActive, setSimulationActive] = useState(false)
  const [sourceToAllMode, setSourceToAllMode] = useState(false)
  const [autoStep, setAutoStep] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(initialWidth)

  const onStartResize = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    startXRef.current = event.clientX
    startWidthRef.current = panelWidth
    setIsResizing(true)
  }, [panelWidth])

  useEffect(() => {
    if (!isResizing) {
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - startXRef.current
      const maxWidth = Math.floor(window.innerWidth * 0.6)
      const nextWidth = Math.min(Math.max(startWidthRef.current + delta, 220), maxWidth)
      setPanelWidth(nextWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const handleGraphChange = useCallback((graph: {
    nodesInfo: NodeInfo[];
    edgesInfo: EdgeInfo[];
    dijkstraRows: DijkstraRow[];
    dijkstraMeta: {
      running: boolean;
      finished: boolean;
      startId: number | null;
      targetId: number | null;
      message: string;
    };
    frontierEdges: FrontierEdge[];
  }) => {
    setNodesInfo(graph.nodesInfo)
    setEdgesInfo(graph.edgesInfo)
    setDijkstraRows(graph.dijkstraRows)
    setDijkstraMeta(graph.dijkstraMeta)
    setFrontierEdges(graph.frontierEdges)
  }, [])

  useEffect(() => {
    if (nodesInfo.length === 0) {
      setSelectedStartId(null)
      setSelectedTargetId(null)
      return
    }

    const nodeIds = new Set(nodesInfo.map((node) => node.id))

    setSelectedStartId((prev) => (prev !== null && nodeIds.has(prev) ? prev : nodesInfo[0].id))
    setSelectedTargetId((prev) => (prev !== null && nodeIds.has(prev) ? prev : nodesInfo[0].id))
  }, [nodesInfo])

  const handleClear = useCallback(() => {
    if (simulationActive) {
      return
    }

    setClearSignal((prev) => prev + 1)
  }, [simulationActive])

  const handleStartDijkstra = useCallback(() => {
    if (selectedStartId === null || simulationActive) {
      return
    }

    if (!sourceToAllMode && selectedTargetId === null) {
      return
    }

    setSimulationActive(true)
    setAutoStep(false)
    setStartRequestNonce((prev) => prev + 1)
  }, [selectedStartId, selectedTargetId, simulationActive, sourceToAllMode])

  const handleNextStep = useCallback(() => {
    if (!simulationActive) {
      return
    }

    setStepSignal((prev) => prev + 1)
  }, [simulationActive])

  const handleResetSimulation = useCallback(() => {
    setSimulationActive(false)
    setAutoStep(false)
  }, [])

  const handleToggleAuto = useCallback(() => {
    if (!simulationActive || dijkstraMeta.finished) {
      return
    }

    setAutoStep((prev) => !prev)
  }, [dijkstraMeta.finished, simulationActive])

  const handleGenerateRandom = useCallback(() => {
    if (simulationActive) {
      return
    }
    setRandomRequestNonce((prev) => prev + 1)
  }, [simulationActive])

  useEffect(() => {
    if (simulationActive && dijkstraMeta.finished) {
      setSimulationActive(false)
      setAutoStep(false)
    }
  }, [simulationActive, dijkstraMeta.finished])

  useEffect(() => {
    if (!simulationActive || !autoStep || dijkstraMeta.finished) {
      return
    }

    const intervalId = window.setInterval(() => {
      setStepSignal((prev) => prev + 1)
    }, 700)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [autoStep, dijkstraMeta.finished, simulationActive])

  const startRequest = useMemo(
    () => simulationActive && selectedStartId !== null && selectedTargetId !== null
      ? {
        nonce: startRequestNonce,
        startId: selectedStartId,
        targetId: sourceToAllMode ? null : selectedTargetId,
      }
      : null,
    [simulationActive, selectedStartId, selectedTargetId, sourceToAllMode, startRequestNonce],
  )

  const randomRequest = useMemo(
    () => ({
      nonce: randomRequestNonce,
      n: randomN,
      m: randomM,
    }),
    [randomRequestNonce, randomN, randomM],
  )

  return (
    <main className={`app${isResizing ? ' is-resizing' : ''}`}>
      <header className="app-header">
        <h1>Visualizador Dijkstra</h1>
        <p>Redes de Computadores. Jorge Marles. 1152255</p>
      </header>

      <section className="app-content">
        <aside className="side-panel" aria-label="Panel lateral" style={{ width: `${panelWidth}px` }}>
          <h2>Panel</h2>
          <div className="side-panel-body">
            <div className="side-panel-section">
              <h2>Controles</h2>
              <p>                Doble click en un espacio vacío para poner un nuevo Nodo.</p>
              <p>                Arrastra entre 2 nodos para crear un enlace.              </p>
              <p>                Click derecho sobre un nodo o enlace para eliminarlo              </p>
            </div>
            <div className="side-panel-section">
              <p className="side-panel-kpi">Nodos: {nodesInfo.length}</p>
              <p className="side-panel-kpi">Enlaces: {edgesInfo.length}</p>
            </div>

            <div className="side-panel-section">
              <h3>Dijkstra</h3>
              <div className="side-panel-form-grid">
                <label className="side-panel-checkbox-row">
                  <input
                    type="checkbox"
                    checked={sourceToAllMode}
                    onChange={(event) => setSourceToAllMode(event.target.checked)}
                    disabled={simulationActive}
                  />
                  Ejecutar desde fuente hacia todos
                </label>

                <label htmlFor="start-node">Nodo inicio</label>
                <select
                  id="start-node"
                  value={selectedStartId ?? ''}
                  onChange={(event) => setSelectedStartId(Number(event.target.value))}
                  disabled={simulationActive || nodesInfo.length === 0}
                >
                  {nodesInfo.map((node) => (
                    <option key={node.id} value={node.id}>{node.name}</option>
                  ))}
                </select>

                <label htmlFor="target-node">Nodo destino</label>
                <select
                  id="target-node"
                  value={selectedTargetId ?? ''}
                  onChange={(event) => setSelectedTargetId(Number(event.target.value))}
                  disabled={simulationActive || nodesInfo.length === 0 || sourceToAllMode}
                >
                  {nodesInfo.map((node) => (
                    <option key={node.id} value={node.id}>{node.name}</option>
                  ))}
                </select>
              </div>
              <p className="side-panel-status">Estado: {dijkstraMeta.message}</p>
            </div>

            <div className="side-panel-section">
              <h3>Generador aleatorio</h3>
              <div className="side-panel-form-grid">
                <label htmlFor="random-n">Nodos (n)</label>
                <input
                  id="random-n"
                  type="number"
                  min={1}
                  value={randomN}
                  onChange={(event) => setRandomN(Number(event.target.value))}
                  disabled={simulationActive}
                />

                <label htmlFor="random-m">Enlaces (m) (máximo n*(n-1)/2)</label>
                <input
                  id="random-m"
                  type="number"
                  min={0}
                  value={randomM}
                  onChange={(event) => setRandomM(Number(event.target.value))}
                  disabled={simulationActive}
                />
              </div>
            </div>

            <div className="side-panel-section">
              <h3>Tabla de distancias</h3>
              <div className="side-panel-table-wrap">
                <table className="side-panel-table">
                  <thead>
                    <tr>
                      <th>Nodo</th>
                      <th>Distancia</th>
                      <th>Predecesor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dijkstraRows.map((row) => (
                      <tr key={row.nodeId} className={row.visited ? 'is-visited' : ''}>
                        <td>{row.nodeId}</td>
                        <td>{Number.isFinite(row.distance) ? row.distance : '∞'}</td>
                        <td>{row.predecessor ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="side-panel-section">
              <h3>Frontera permanente → temporal</h3>
              <ul className="side-panel-list">
                {frontierEdges.map((edge) => (
                  <li key={`f-${edge.idFrom}-${edge.idTo}`}>
                    <span>{edge.idFrom} → {edge.idTo}</span>
                    <span>{edge.cost}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="side-panel-section">
              <h3>Nodos</h3>
              <ul className="side-panel-list">
                {nodesInfo.map((node) => (
                  <li key={node.id} className={node.visited ? 'is-visited' : ''}>
                    <span>{node.name}</span>
                    <span>{node.visited ? 'Marca Permanente' : 'Marca Temporal'}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="side-panel-section">
              <h3>Enlaces</h3>
              <ul className="side-panel-list">
                {edgesInfo.map((edge) => (
                  <li key={`${edge.idFrom}-${edge.idTo}`} className={edge.used ? 'is-used' : ''}>
                    <span>{edge.idFrom} → {edge.idTo}</span>
                    <span>{edge.cost}</span>
                  </li>
                ))}
              </ul>
            </div>


          </div>

          <div className="side-panel-actions">
            <button
              type="button"
              onClick={handleStartDijkstra}
              disabled={simulationActive || selectedStartId === null || selectedTargetId === null}
            >
              Iniciar
            </button>
            <button type="button" onClick={handleNextStep} disabled={!simulationActive || dijkstraMeta.finished}>
              Siguiente paso
            </button>
            <button type="button" onClick={handleToggleAuto} disabled={!simulationActive || dijkstraMeta.finished}>
              {autoStep ? 'Detener auto' : 'Paso automatico'}
            </button>
            <button type="button" onClick={handleClear} disabled={simulationActive}>Limpiar
            </button>
            <button type="button" onClick={handleResetSimulation} disabled={!simulationActive}>Salir simulacion</button>
            <button type="button" onClick={handleGenerateRandom} disabled={simulationActive}>Generar random</button>
          </div>
        </aside>

        <div
          className={`side-panel-grip${isResizing ? ' is-resizing' : ''}`}
          role="separator"
          aria-label="Redimensionar panel"
          onMouseDown={onStartResize}
        />

        <section className="flow-wrapper" aria-label="Grafo interactivo">
          <CustomFlow
            onGraphChange={handleGraphChange}
            clearSignal={clearSignal}
            startRequest={startRequest}
            stepSignal={stepSignal}
            randomRequest={randomRequest}
            interactionLocked={simulationActive}
          />
        </section>
      </section>
    </main>
  )
}

export default App
