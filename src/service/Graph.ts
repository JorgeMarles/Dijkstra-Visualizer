export class Edge {
    to: Node;
    cost: number;
    used: boolean;

    constructor(to: Node, cost: number) {
        this.to = to;
        this.cost = cost;
        this.used = false;
    }
}

export type EdgeInfo = {
    idFrom: number;
    idTo: number;
    cost: number;
    used: boolean;
}

export type NodeInfo = {
    visited: boolean;
    id: number;
    name: string;
}

export type DijkstraRow = {
    nodeId: number;
    distance: number;
    predecessor: number | null;
    visited: boolean;
}

export type FrontierEdge = {
    idFrom: number;
    idTo: number;
    cost: number;
}

export class Node {
    id: number;
    name: string;
    visited: boolean;
    edges: Map<number, Edge>;

    constructor(id: number, name: string) {
        this.id = id;
        this.name = name;
        this.visited = false;
        this.edges = new Map();
    }

    addEdge(to: Node, cost: number) {
        const edge = new Edge(to, cost);
        this.edges.set(to.id, edge);
    }

    deleteEdge(to: Node) {
        this.edges.delete(to.id);
    }
}

export class Graph {
    nodes: Map<number, Node>;
    private dijkstraState: {
        startId: number;
        targetId: number | null;
        distances: Map<number, number>;
        predecessors: Map<number, number | null>;
        unvisited: Set<number>;
        running: boolean;
        finished: boolean;
        message: string;
    } | null;

    constructor() {
        this.nodes = new Map();
        this.dijkstraState = null;
    }

    private clearMarks() {
        for (const node of this.nodes.values()) {
            node.visited = false;
            for (const edge of node.edges.values()) {
                edge.used = false;
            }
        }
    }

    private markShortestPath(targetId: number, predecessors: Map<number, number | null>) {
        let current = targetId;

        while (true) {
            const predecessor = predecessors.get(current) ?? null;
            if (predecessor === null) {
                break;
            }

            const fromNode = this.getNode(predecessor);
            const edge = fromNode.edges.get(current);
            if (edge) {
                edge.used = true;
            }

            current = predecessor;
        }
    }

    private markShortestTree(predecessors: Map<number, number | null>) {
        for (const [nodeId, predecessor] of predecessors.entries()) {
            if (predecessor === null) {
                continue;
            }

            const fromNode = this.getNode(predecessor);
            const edge = fromNode.edges.get(nodeId);
            if (edge) {
                edge.used = true;
            }
        }
    }

    private pickMinUnvisited(distances: Map<number, number>, unvisited: Set<number>): number | null {
        let bestId: number | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (const nodeId of unvisited) {
            const distance = distances.get(nodeId) ?? Number.POSITIVE_INFINITY;
            if (distance < bestDistance) {
                bestDistance = distance;
                bestId = nodeId;
            }
        }

        return bestId;
    }

    addNode(): void {
        const usedIds = new Set(this.nodes.keys());
        let id = 0;

        while (usedIds.has(id)) {
            id += 1;
        }

        const node = new Node(id, id.toString());
        this.nodes.set(id, node);
    }

    getNode(id: number): Node {
        const node = this.nodes.get(id);
        if (!node) {
            throw Error(`No existe nodo con idx ${id}`);
        }

        return node;
    }

    deleteNode(id: number) {
        const node = this.getNode(id);
        this.nodes.delete(id);

        for (const current of this.nodes.values()) {
            current.deleteEdge(node);
        }
    }

    addEdge(from: number, to: number, cost: number): void {
        const nFrom = this.getNode(from);
        const nTo = this.getNode(to);
        nFrom.addEdge(nTo, cost);
    }

    deleteEdge(from: number, to: number): void {
        const nFrom = this.getNode(from);
        const nTo = this.getNode(to);
        nFrom.deleteEdge(nTo);
    }

    getNodesInfo(): NodeInfo[] {
        const info: NodeInfo[] = [];

        for (const node of this.nodes.values()) {
            info.push({ id: node.id, name: node.name, visited: node.visited });
        }

        return info;
    }

    getEdgesInfo(): EdgeInfo[] {
        const info: EdgeInfo[] = [];

        for (const from of this.nodes.values()) {
            for (const edge of from.edges.values()) {
                info.push({
                    cost: edge.cost,
                    idFrom: from.id,
                    idTo: edge.to.id,
                    used: edge.used,
                });
            }
        }

        return info;
    }

    initializeDijkstra(startId: number, targetId: number | null) {
        if (!this.nodes.has(startId)) {
            throw Error('Nodo de inicio invalido.');
        }

        if (targetId !== null && !this.nodes.has(targetId)) {
            throw Error('Nodo de destino invalido.');
        }

        this.clearMarks();

        const distances = new Map<number, number>();
        const predecessors = new Map<number, number | null>();
        const unvisited = new Set<number>();

        for (const nodeId of this.nodes.keys()) {
            distances.set(nodeId, Number.POSITIVE_INFINITY);
            predecessors.set(nodeId, null);
            unvisited.add(nodeId);
        }

        distances.set(startId, 0);

        this.dijkstraState = {
            startId,
            targetId,
            distances,
            predecessors,
            unvisited,
            running: true,
            finished: false,
            message: targetId === null ? 'Dijkstra inicializado (fuente a todos)' : 'Dijkstra inicializado',
        };
    }

    stepDijkstra() {
        if (!this.dijkstraState) {
            return;
        }

        const state = this.dijkstraState;
        if (!state.running || state.finished) {
            return;
        }

        const currentId = this.pickMinUnvisited(state.distances, state.unvisited);
        if (currentId === null) {
            state.running = false;
            state.finished = true;
            state.message = 'No hay nodos pendientes';
            return;
        }

        const currentDistance = state.distances.get(currentId) ?? Number.POSITIVE_INFINITY;
        if (!Number.isFinite(currentDistance)) {
            state.running = false;
            state.finished = true;
            state.message = 'No existe camino al destino';
            return;
        }

        state.unvisited.delete(currentId);
        const currentNode = this.getNode(currentId);
        currentNode.visited = true;

        for (const edge of currentNode.edges.values()) {
            const nextId = edge.to.id;
            if (!state.unvisited.has(nextId)) {
                continue;
            }

            const candidateDistance = currentDistance + edge.cost;
            const knownDistance = state.distances.get(nextId) ?? Number.POSITIVE_INFINITY;

            if (candidateDistance < knownDistance) {
                state.distances.set(nextId, candidateDistance);
                state.predecessors.set(nextId, currentId);
            }
        }

        if (state.targetId !== null && currentId === state.targetId) {
            this.markShortestPath(state.targetId, state.predecessors);
            state.running = false;
            state.finished = true;
            state.message = 'Ruta minima encontrada';
            return;
        }

        if (state.unvisited.size === 0) {
            if (state.targetId === null) {
                this.markShortestTree(state.predecessors);
                state.message = 'Distancias minimas calculadas para todos los nodos';
            } else {
                const targetDistance = state.distances.get(state.targetId) ?? Number.POSITIVE_INFINITY;
                if (Number.isFinite(targetDistance)) {
                    this.markShortestPath(state.targetId, state.predecessors);
                    state.message = 'Ruta minima encontrada';
                } else {
                    state.message = 'No existe camino al destino';
                }
            }
            state.running = false;
            state.finished = true;
            return;
        }

        state.message = `Nodo ${currentId} marcado permanente`;
    }

    getDijkstraTable(): DijkstraRow[] {
        const rows: DijkstraRow[] = [];

        const orderedIds = [...this.nodes.keys()].sort((a, b) => a - b);
        for (const nodeId of orderedIds) {
            const node = this.getNode(nodeId);
            if (!this.dijkstraState) {
                rows.push({
                    nodeId,
                    distance: Number.POSITIVE_INFINITY,
                    predecessor: null,
                    visited: node.visited,
                });
                continue;
            }

            rows.push({
                nodeId,
                distance: this.dijkstraState.distances.get(nodeId) ?? Number.POSITIVE_INFINITY,
                predecessor: this.dijkstraState.predecessors.get(nodeId) ?? null,
                visited: node.visited,
            });
        }

        return rows;
    }

    getDijkstraMeta() {
        if (!this.dijkstraState) {
            return {
                running: false,
                finished: false,
                startId: null as number | null,
                targetId: null as number | null,
                message: 'Sin ejecucion activa',
            };
        }

        return {
            running: this.dijkstraState.running,
            finished: this.dijkstraState.finished,
            startId: this.dijkstraState.startId,
            targetId: this.dijkstraState.targetId,
            message: this.dijkstraState.message,
        };
    }

    getPermanentToTemporaryEdges(): FrontierEdge[] {
        const edges: FrontierEdge[] = [];

        for (const fromNode of this.nodes.values()) {
            if (!fromNode.visited) {
                continue;
            }

            for (const edge of fromNode.edges.values()) {
                if (edge.to.visited) {
                    continue;
                }

                edges.push({
                    idFrom: fromNode.id,
                    idTo: edge.to.id,
                    cost: edge.cost,
                });
            }
        }

        return edges;
    }
}
