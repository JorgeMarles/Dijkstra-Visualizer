import {
    BaseEdge,
    getStraightPath,
    type EdgeProps,
} from '@xyflow/react';

type CenteredEdgeData = {
    hasReverseEdge?: boolean;
    reverseDirection?: boolean;
    collapsedPair?: boolean;
};

function buildOffsetCurve(
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number,
    offsetMagnitude: number,
    directionSign: number,
) {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const length = Math.hypot(dx, dy) || 1;

    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;

    const perpX = (-dy / length) * offsetMagnitude * directionSign;
    const perpY = (dx / length) * offsetMagnitude * directionSign;

    const controlX = midX + perpX;
    const controlY = midY + perpY;

    const path = `M ${sourceX} ${sourceY} Q ${controlX} ${controlY} ${targetX} ${targetY}`;
    const labelX = (sourceX + 2 * controlX + targetX) / 4;
    const labelY = (sourceY + 2 * controlY + targetY) / 4;

    return [path, labelX, labelY] as const;
}

export default function CenteredEdge(props: EdgeProps) {
    const {
        id,
        sourceX,
        sourceY,
        targetX,
        targetY,
        markerEnd,
        label,
        style,
        data,
    } = props;

    const edgeData = (data ?? {}) as CenteredEdgeData;
    const hasReverseEdge = Boolean(edgeData.hasReverseEdge);
    const isReverseDirection = Boolean(edgeData.reverseDirection);
    const offsetMagnitude = hasReverseEdge && isReverseDirection ? 64 : 0;
    const directionSign = Number(props.source) < Number(props.target) ? 1 : -1;

    let path = '';
    let labelX = (sourceX + targetX) / 2;
    let labelY = (sourceY + targetY) / 2;

    if (offsetMagnitude === 0) {
        [path, labelX, labelY] = getStraightPath({
            sourceX,
            sourceY,
            targetX,
            targetY,
        });
    } else {
        [path, labelX, labelY] = buildOffsetCurve(
            sourceX,
            sourceY,
            targetX,
            targetY,
            offsetMagnitude,
            directionSign,
        );
    }

    return <BaseEdge id={id} path={path} markerEnd={markerEnd} label={label} labelX={labelX} labelY={labelY} style={style} />;
}
