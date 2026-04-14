import { useMemo } from 'react'
import ReactFlow, { Background, Controls, MiniMap, type Edge, type Node } from 'reactflow'
import 'reactflow/dist/style.css'
import './App.css'

function App() {
  const nodes = useMemo<Node[]>(
    () => [
      {
        id: 'n1',
        position: { x: 80, y: 120 },
        data: { label: 'Inicio' },
        style: { border: '1px solid #1e293b', borderRadius: 8, padding: 8 },
      },
      {
        id: 'n2',
        position: { x: 320, y: 120 },
        data: { label: 'Dijkstra' },
        style: { border: '1px solid #1e293b', borderRadius: 8, padding: 8 },
      },
      {
        id: 'n3',
        position: { x: 560, y: 120 },
        data: { label: 'Resultado' },
        style: { border: '1px solid #1e293b', borderRadius: 8, padding: 8 },
      },
    ],
    [],
  )

  const edges = useMemo<Edge[]>(
    () => [
      { id: 'e1-2', source: 'n1', target: 'n2', animated: true, label: 'peso 4' },
      { id: 'e2-3', source: 'n2', target: 'n3', animated: true, label: 'peso 2' },
    ],
    [],
  )

  return (
    <main className="app">
      <header>
        <h1>Dijkstra Visualizer</h1>
        <p>Proyecto React + Vite + TypeScript usando reactflow.</p>
      </header>

      <section className="flow-wrapper">
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </section>
    </main>
  )
}

export default App
