import {
  Button,
  Group,
  Tree,
  useTree,
  TreeNodeData,
  Box,
  RenderTreeNodePayload,
} from "@mantine/core";
import { useMemo } from "react";
import { Plus, Minus } from "@phosphor-icons/react";

interface JsonTreeViewerProps {
  jsonData: object;
}

function transformJsonToTreeData(
  json: object,
  path: string = ""
): TreeNodeData[] {
  return Object.entries(json).map(([key, value]) => {
    const newPath = path ? `${path}.${key}` : key;
    const node: TreeNodeData = {
      value: newPath,
      label: key,
    };
    if (Array.isArray(value)) {
      node.label = `${key} (${value.length})`;
      node.children = value.map((item, index) => {
        const itemPath = `${newPath}[${index}]`;
        const childNode: TreeNodeData = {
          value: itemPath,
          label: `[${index}]`,
        };
        if (typeof item === "object" && item !== null) {
          childNode.children = transformJsonToTreeData(item, itemPath);
        } else {
          childNode.label = `[${index}]: ${JSON.stringify(item)}`;
        }
        return childNode;
      });
    } else if (typeof value === "object" && value !== null) {
      node.children = transformJsonToTreeData(value, newPath);
    } else {
      node.label = `${key}: ${JSON.stringify(value)}`;
    }
    return node;
  });
}

const JsonTreeViewer = ({ jsonData }: JsonTreeViewerProps) => {
  const tree = useTree();

  const data = useMemo(() => transformJsonToTreeData(jsonData), [jsonData]);

  const renderNode = ({
    node,
    expanded,
    hasChildren,
    elementProps,
    level,
  }: RenderTreeNodePayload) => (
    <Group
      gap="xs"
      {...elementProps}
      onClick={() => hasChildren && tree.toggleExpanded(node.value)}
      style={{ ...elementProps.style, cursor: "pointer", position: "relative" }}
    >
      {Array.from({ length: level }).map((_, i) => (
        <Box
          key={i}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: i * 24 + 12,
            width: "1px",
            backgroundColor: "rgba(0, 0, 0, 0.1)",
          }}
        />
      ))}
      {hasChildren ? (
        expanded ? (
          <Minus size={14} />
        ) : (
          <Plus size={14} />
        )
      ) : (
        <Box w={14} />
      )}
      <Box>{node.label}</Box>
    </Group>
  );

  return (
    <>
      <Group mb="md">
        <Button onClick={() => tree.expandAllNodes()} size="xs">
          Expand all
        </Button>
        <Button onClick={() => tree.collapseAllNodes()} size="xs">
          Collapse all
        </Button>
      </Group>
      <Tree
        data={data}
        tree={tree}
        renderNode={renderNode}
        levelOffset={24}
        style={{ fontFamily: "monospace", fontSize: "12px" }}
      />
    </>
  );
};

export default JsonTreeViewer;
