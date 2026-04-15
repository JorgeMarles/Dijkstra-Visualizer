import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { NodeInfo } from "../service/Graph.ts";

type CustomGraphNode = Node<NodeInfo, 'gnode'>

const centerHiddenHandleStyle = {
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    opacity: 0,
    width: 14,
    height: 14,
    border: 0,
    background: "transparent",
};

const CustomNode = ({ data }: NodeProps<CustomGraphNode>) => {
    return (
        <div>
            <h2>{data.name}</h2>
            <Handle
                id="center-target"
                type="target"
                position={Position.Top}
                style={centerHiddenHandleStyle}
            />

            <Handle
                id="center-source"
                type="source"
                position={Position.Top}
                style={centerHiddenHandleStyle}
            />
        </div>
    );
}

export default CustomNode;