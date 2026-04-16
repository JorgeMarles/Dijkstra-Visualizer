import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ReactFlow,
    applyNodeChanges,
    applyEdgeChanges,
    type Connection,
    type Node,
    type Edge,
    type FitViewOptions,
    type OnConnect,
    type OnNodesChange,
    type OnEdgesChange,
    type DefaultEdgeOptions,
    ConnectionMode,
    type ReactFlowInstance,
} from '@xyflow/react';
import { Background, Controls, Panel } from '@xyflow/react';
import CustomNode from './CustomNode';
import CenteredEdge from './CenteredEdge';
import { Graph, type DijkstraRow, type EdgeInfo, type FrontierEdge, type NodeInfo } from '../service/Graph.ts';

type CustomFlowProps = {
    onGraphChange?: (graph: {
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
    }) => void;
    clearSignal?: number;
    startRequest?: { nonce: number; startId: number; targetId: number | null } | null;
    stepSignal?: number;
    randomRequest?: { nonce: number; n: number; m: number } | null;
    interactionLocked?: boolean;
};

const initialNodes: Node[] = [];

const initialEdges: Edge[] = [];

const fitViewOptions: FitViewOptions = {
    padding: 0,
};

const defaultEdgeOptions: DefaultEdgeOptions = {
    animated: true,
};

const nodeTypes = {
    gnode: CustomNode
}

const edgeTypes = {
    centered: CenteredEdge,
};

const visitedStyle = { background: '#fef9c3', color: '#111827', borderColor: '#f59e0b' }

const usedStyle = '#2563eb'

function CustomFlow({ onGraphChange, clearSignal, startRequest, stepSignal, randomRequest, interactionLocked = false }: CustomFlowProps) {
    const graphRef = useRef<Graph>(new Graph());
    const lastStartNonceRef = useRef<number>(-1);
    const lastRandomNonceRef = useRef<number>(-1);
    const lastStepSignalRef = useRef<number | null>(null);
    const [nodes, setNodes] = useState<Node[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);
    const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<Node, Edge> | null>(null);
    const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
    const [linkCost, setLinkCost] = useState<string>('1');
    const [isBidirectional, setIsBidirectional] = useState<boolean>(true);

    const mapNodesInfoToFlowNodes = useCallback(
        (nodesInfo: NodeInfo[], previousNodes: Node[]): Node[] => {
            const previousById = new Map(previousNodes.map((node) => [node.id, node]));

            const deg = 2*Math.PI / nodesInfo.length;
            const radius = nodesInfo.length * 14;


            return nodesInfo.map((nodeInfo, index) => {
                const id = String(nodeInfo.id);
                const previousNode = previousById.get(id);

                return {
                    id,
                    type: 'gnode',
                    data: { name: nodeInfo.name ?? id, id: nodeInfo.id ?? index },
                    className: 'react-flow__node-default my-node',
                    style: nodeInfo.visited ? visitedStyle : undefined,
                    position:
                        previousNode?.position ?? {
                            x: 100 + radius * Math.sin(index * deg),
                            y: 100 + radius * Math.cos(index * deg),
                        },
                };
            });
        },
        [],
    );

    const mapEdgesInfoToFlowEdges = useCallback((edgesInfo: EdgeInfo[]): Edge[] => {
        const groupedEdges = new Map<string, EdgeInfo[]>();

        for (const edgeInfo of edgesInfo) {
            const pairKey = edgeInfo.idFrom < edgeInfo.idTo
                ? `${edgeInfo.idFrom}-${edgeInfo.idTo}`
                : `${edgeInfo.idTo}-${edgeInfo.idFrom}`;
            const currentGroup = groupedEdges.get(pairKey) ?? [];
            currentGroup.push(edgeInfo);
            groupedEdges.set(pairKey, currentGroup);
        }

        const renderedEdges: Edge[] = [];

        for (const group of groupedEdges.values()) {
            const sortedGroup = [...group].sort((left, right) => {
                if (left.idFrom !== right.idFrom) {
                    return left.idFrom - right.idFrom;
                }

                return left.idTo - right.idTo;
            });

            const sameWeightPair =
                sortedGroup.length === 2 && sortedGroup[0].cost === sortedGroup[1].cost;

            if (sameWeightPair) {
                const mergedEdge = sortedGroup[0];
                const mergedUsed = sortedGroup.some((edge) => edge.used);

                renderedEdges.push({
                    id: `e-${mergedEdge.idFrom}-${mergedEdge.idTo}`,
                    source: String(mergedEdge.idFrom),
                    target: String(mergedEdge.idTo),
                    sourceHandle: 'center-source',
                    targetHandle: 'center-target',
                    label: String(mergedEdge.cost),
                    type: 'centered',
                    className: 'flow-edge',
                    animated: false,
                    style: {
                        stroke: mergedUsed ? usedStyle : '#334155',
                    },
                    data: { hasReverseEdge: true, reverseDirection: false, collapsedPair: true },
                });

                continue;
            }

            for (const edgeInfo of sortedGroup) {
                const hasReverseEdge = sortedGroup.length > 1;
                const isReverseDirection = hasReverseEdge && edgeInfo.idFrom > edgeInfo.idTo;

                renderedEdges.push({
                    id: `e-${edgeInfo.idFrom}-${edgeInfo.idTo}`,
                    source: String(edgeInfo.idFrom),
                    target: String(edgeInfo.idTo),
                    sourceHandle: 'center-source',
                    targetHandle: 'center-target',
                    label: String(edgeInfo.cost),
                    type: 'centered',
                    className: 'flow-edge',
                    animated: true,
                    style: {
                        stroke: edgeInfo.used ? usedStyle : '#334155',
                    },
                    data: {
                        hasReverseEdge,
                        reverseDirection: isReverseDirection,
                        collapsedPair: false,
                    },
                });
            }
        }

        return renderedEdges;
    }, []);

    const syncFromGraph = useCallback((preservePositions: boolean = true) => {
        const nodesInfo = graphRef.current.getNodesInfo();
        const edgesInfo = graphRef.current.getEdgesInfo();
        const dijkstraRows = graphRef.current.getDijkstraTable();
        const dijkstraMeta = graphRef.current.getDijkstraMeta();
        const frontierEdges = graphRef.current.getPermanentToTemporaryEdges();
        setNodes((previousNodes) =>
            mapNodesInfoToFlowNodes(nodesInfo, preservePositions ? previousNodes : []),
        );
        setEdges(mapEdgesInfoToFlowEdges(edgesInfo));
        onGraphChange?.({ nodesInfo, edgesInfo, dijkstraRows, dijkstraMeta, frontierEdges });
    }, [mapEdgesInfoToFlowEdges, mapNodesInfoToFlowNodes, onGraphChange]);


    useEffect(() => {
        if (!startRequest) {
            return;
        }

        if (lastStartNonceRef.current === startRequest.nonce) {
            return;
        }

        lastStartNonceRef.current = startRequest.nonce;

        try {
            graphRef.current.initializeDijkstra(startRequest.startId, startRequest.targetId);
            syncFromGraph();
        } catch {
            syncFromGraph();
        }
    }, [startRequest, syncFromGraph]);

    useEffect(() => {
        if (clearSignal === undefined) {
            return;
        }

        graphRef.current = new Graph();
        setPendingConnection(null);
        setLinkCost('1');
        setIsBidirectional(true);
        syncFromGraph(false);
    }, [clearSignal, syncFromGraph]);

    useEffect(() => {
        if (!randomRequest) {
            return;
        }

        if (randomRequest.nonce <= 0) {
            return;
        }

        if (lastRandomNonceRef.current === randomRequest.nonce) {
            return;
        }

        lastRandomNonceRef.current = randomRequest.nonce;

        const n = Math.max(1, Math.floor(randomRequest.n));
        const m = Math.max(0, Math.floor(randomRequest.m));

        graphRef.current = new Graph();
        for (let i = 0; i < n; i += 1) {
            graphRef.current.addNode();
        }

        const maxEdges = n > 1 ? n * (n - 1) : 0;
        const targetEdges = Math.min(m, maxEdges);
        let created = 0;
        let attempts = 0;
        const maxAttempts = Math.max(100, targetEdges * 30);

        while (created < targetEdges && attempts < maxAttempts) {
            attempts += 1;
            const from = Math.floor(Math.random() * n);
            const to = Math.floor(Math.random() * n);

            if (from === to) {
                continue;
            }

            const fromNode = graphRef.current.getNode(from);
            if (fromNode.edges.has(to)) {
                continue;
            }

            const cost = Math.floor(Math.random() * 20) + 1;
            graphRef.current.addEdge(from, to, cost);
            graphRef.current.addEdge(to, from, cost);
            created += 1;
        }

        setPendingConnection(null);
        setLinkCost('1');
        setIsBidirectional(true);
        syncFromGraph(false);
    }, [randomRequest, syncFromGraph]);

    useEffect(() => {
        if (interactionLocked) {
            setPendingConnection(null);
        }
    }, [interactionLocked]);

    useEffect(() => {
        if (stepSignal === undefined) {
            return;
        }

        if (lastStepSignalRef.current === null) {
            lastStepSignalRef.current = stepSignal;
            return;
        }

        if (lastStepSignalRef.current === stepSignal) {
            return;
        }

        lastStepSignalRef.current = stepSignal;

        graphRef.current.stepDijkstra();
        syncFromGraph();
    }, [stepSignal, syncFromGraph]);

    const onNodesChange: OnNodesChange = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
        [setNodes],
    );
    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        [setEdges],
    );

    const onConnect: OnConnect = useCallback(
        (connection) => {
            if (interactionLocked) {
                return;
            }

            if (!connection.source || !connection.target) {
                return;
            }

            setPendingConnection(connection);
        },
        [interactionLocked],
    );

    const onPaneClick = useCallback(
        (event: React.MouseEvent) => {
            if (interactionLocked) {
                return;
            }

            if (event.detail !== 2) {
                return;
            }

            event.preventDefault();
            graphRef.current.addNode();

            const newestNode = graphRef.current.getNodesInfo().at(-1);
            const nodeId = newestNode?.id !== undefined ? String(newestNode.id) : null;
            syncFromGraph();

            if (!flowInstance || !nodeId) {
                return;
            }

            const position = flowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
            setNodes((previousNodes) =>
                previousNodes.map((node) =>
                    node.id === nodeId
                        ? {
                            ...node,
                            position,
                        }
                        : node,
                ),
            );
        },
        [flowInstance, interactionLocked, syncFromGraph],
    );

    const onNodeContextMenu = useCallback(
        (event: React.MouseEvent, node: Node) => {
            event.preventDefault();

            if (interactionLocked) {
                return;
            }

            graphRef.current.deleteNode(Number(node.id));
            syncFromGraph();
        },
        [interactionLocked, syncFromGraph],
    );

    const onEdgeContextMenu = useCallback(
        (event: React.MouseEvent, edge: Edge) => {
            event.preventDefault();

            if (interactionLocked) {
                return;
            }

            const from = Number(edge.source);
            const to = Number(edge.target);
            const isCollapsedPair = Boolean(edge.data?.collapsedPair);

            graphRef.current.deleteEdge(from, to);

            if (isCollapsedPair) {
                graphRef.current.deleteEdge(to, from);
            }

            syncFromGraph();
        },
        [interactionLocked, syncFromGraph],
    );

    const confirmLinkCreation = useCallback(() => {
        if (!pendingConnection?.source || !pendingConnection?.target) {
            return;
        }

        const cost = Number(linkCost);
        if (!Number.isFinite(cost) || cost < 0) {
            return;
        }

        const from = Number(pendingConnection.source);
        const to = Number(pendingConnection.target);

        graphRef.current.addEdge(from, to, cost);

        if (isBidirectional) {
            graphRef.current.addEdge(to, from, cost);
        }

        setPendingConnection(null);
        setLinkCost('1');
        setIsBidirectional(true);
        syncFromGraph();
    }, [isBidirectional, linkCost, pendingConnection, syncFromGraph]);

    const cancelLinkCreation = useCallback(() => {
        setPendingConnection(null);
        setLinkCost('1');
        setIsBidirectional(true);
    }, []);

    return (
        <>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onPaneClick={onPaneClick}
                onNodeContextMenu={onNodeContextMenu}
                onEdgeContextMenu={onEdgeContextMenu}
                onInit={setFlowInstance}
                nodesDraggable={!interactionLocked}
                nodesConnectable={!interactionLocked}
                elementsSelectable={!interactionLocked}
                fitView
                connectionMode={ConnectionMode.Loose}
                fitViewOptions={fitViewOptions}
                defaultEdgeOptions={defaultEdgeOptions}
            >
                <Background />
                <Controls />
                <Panel position="top-right" style={{ background: 'white', padding: '10px', borderRadius: '5px', boxShadow: '0 0 10px rgba(0,0,0,0.1)', fontSize: '12px' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Convenciones</h4>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                        <div style={{ width: '16px', height: '16px', border: '1px solid #1a192b', borderRadius: '50%', marginRight: '8px', background: 'white' }}></div>
                        <span>Nodo normal: marca temporal</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                        <div style={{ width: '16px', height: '16px', border: '1px solid #f59e0b', borderRadius: '50%', marginRight: '8px', background: '#fef9c3' }}></div>
                        <span>Nodo amarillo: marca permanente</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                        <div style={{ width: '16px', height: '2px', background: '#334155', marginRight: '8px' }}></div>
                        <span>Arista negra: no usada</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: '16px', height: '2px', background: '#2563eb', marginRight: '8px' }}></div>
                        <span>Arista azul: ruta mínima</span>
                    </div>
                </Panel>
            </ReactFlow>

            {pendingConnection && (
                <div className="link-modal-backdrop" role="presentation" onClick={cancelLinkCreation}>
                    <div className="link-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                        <h3>Crear enlace</h3>
                        <p>Configura el nuevo enlace entre nodos.</p>

                        <label htmlFor="link-cost">Costo numérico</label>
                        <input
                            id="link-cost"
                            type="number"
                            value={linkCost}
                            onChange={(event) => setLinkCost(event.target.value)}
                            min="0"
                            step="1"
                        />

                        <label className="link-modal-checkbox">
                            <input
                                type="checkbox"
                                checked={isBidirectional}
                                onChange={(event) => setIsBidirectional(event.target.checked)}
                            />
                            Enlace bidireccional
                        </label>

                        <div className="link-modal-actions">
                            <button type="button" onClick={cancelLinkCreation}>
                                Cancelar
                            </button>
                            <button type="button" onClick={confirmLinkCreation}>
                                Crear enlace
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default CustomFlow;