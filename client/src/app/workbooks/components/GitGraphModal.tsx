import { ModalWrapper } from '@/app/components/ModalWrapper';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { workbookApi } from '@/lib/api/workbook';
import { Gitgraph, templateExtend, TemplateName } from '@gitgraph/react';
import { ActionIcon, Code, Loader, ScrollArea, Text } from '@mantine/core';
import { WorkbookId } from '@spinner/shared-types';
import { Code2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// Import dayjs
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface GitGraphModalProps {
  workbookId: WorkbookId;
  isOpen: boolean;
  onClose: () => void;
}

// Helper to build commit info
const buildCommitInfo = (commit: CommitData, refs: string[]) => {
  const msg = commit.message.trim().split('\n')[0];
  const timeAgo = dayjs.unix(commit.timestamp).fromNow();
  const refString = refs.length > 0 ? refs.map((r) => `[${r}]`).join(' ') : '';

  const line1 = `${commit.oid.substring(0, 7)} - ${timeAgo} ${refString}`;
  return { subject: line1, body: msg };
};

interface CommitData {
  oid: string;
  message: string;
  parents: string[];
  timestamp: number;
  author: { name: string; email: string };
}

interface RefData {
  name: string;
  oid: string;
  type: 'branch' | 'tag';
}

interface GraphData {
  commits: CommitData[];
  refs: RefData[];
}

export const GitGraphModal = ({ workbookId, isOpen, onClose }: GitGraphModalProps) => {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRenderKey((k) => k + 1);
      fetchGraph();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, workbookId]);

  const fetchGraph = async () => {
    setLoading(true);
    try {
      const graphData = await workbookApi.getGraph(workbookId);
      setData(graphData as GraphData);
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({
        title: 'Error',
        message: 'Could not load git graph.',
      });
    } finally {
      setLoading(false);
    }
  };

  const title = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span>Git Graph</span>
      {data && (
        <ActionIcon
          size="sm"
          variant={showRaw ? 'filled' : 'subtle'}
          onClick={() => setShowRaw(!showRaw)}
          title="Toggle Raw Data"
        >
          <Code2 size={16} />
        </ActionIcon>
      )}
    </div>
  );

  return (
    <ModalWrapper
      title={title}
      opened={isOpen}
      onClose={onClose}
      size="xl"
      customProps={{
        footer: null,
        noBodyPadding: true,
      }}
    >
      <ScrollArea style={{ height: 600 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader />
          </div>
        ) : !data || data.commits.length === 0 ? (
          <Text p="xl">No commits found</Text>
        ) : showRaw ? (
          <Code block style={{ whiteSpace: 'pre-wrap', margin: 20 }}>
            {JSON.stringify(data, null, 2)}
          </Code>
        ) : (
          <GitGraphRenderer key={renderKey} data={data} />
        )}
      </ScrollArea>
    </ModalWrapper>
  );
};

// Separate component to handle rendering with ref guard
const GitGraphRenderer = ({ data }: { data: GraphData }) => {
  const hasPopulatedRef = useRef(false);

  return (
    <div style={{ padding: 20 }}>
      {/* Gitgraph options remain same */}
      <Gitgraph
        options={{
          template: templateExtend(TemplateName.Metro, {
            colors: ['#0088CC', '#27ae60', '#e74c3c', '#f39c12', '#9b59b6'],
            branch: {
              lineWidth: 2,
              spacing: 30,
              label: {
                display: false, // Hide native branch labels if we rely on manual refs? User said "do not render the tags in the native way", probably meant branch labels too if they align badly?
                // "at the moment the top commit is both dirty and main but only main is shown" -> implies native branch labeling only shows one.
                // So manual ref string is better.
                font: '10px sans-serif',
                borderRadius: 4,
              },
            },
            commit: {
              spacing: 24,
              dot: { size: 6 },
              message: {
                displayAuthor: false,
                displayHash: false,
                font: '12px monospace',
              },
            },
          }),
        }}
      >
        {(gitgraph) => {
          if (hasPopulatedRef.current) return;
          hasPopulatedRef.current = true;

          // Map OID -> Refs
          const refsByOid = new Map<string, RefData[]>();
          data.refs.forEach((r) => {
            const list = refsByOid.get(r.oid) || [];
            list.push(r);
            refsByOid.set(r.oid, list);
          });

          // Sort commits: oldest first (backend sorts desc, we need asc for gitgraph usually? No, gitgraph usually builds from whatever we feed it which is linear history)
          // The backend returns DESC (newest first). Gitgraph usually expects this order to build correctly implicitly?
          // Wait, existing code did: [...data.commits].sort((a,b) => a.author.timestamp - b.author.timestamp). This is ASCENDING (oldest first).
          // So we should keep that.

          const sortedCommits = [...data.commits].sort((a, b) => a.timestamp - b.timestamp);
          const commitMap = new Map<string, CommitData>();
          data.commits.forEach((c) => commitMap.set(c.oid, c));

          // ... (oidToBranchName, branchObjs logic remains)
          const oidToBranchName = new Map<string, string>();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const branchObjs = new Map<string, any>();

          // Pre-calculate branch ownership (naive: walk back from tips)
          const branchTips = data.refs.filter((r) => r.type === 'branch');
          const priority = ['main', 'master', 'dirty']; // priority list

          branchTips.sort((a, b) => {
            const idxA = priority.indexOf(a.name);
            const idxB = priority.indexOf(b.name);
            if (idxA > -1 && idxB > -1) return idxA - idxB;
            if (idxA > -1) return -1;
            if (idxB > -1) return 1;
            return a.name.localeCompare(b.name);
          });

          const getOrInitBranch = (name: string) => {
            if (!branchObjs.has(name)) {
              branchObjs.set(name, gitgraph.branch(name));
            }
            return branchObjs.get(name);
          };

          if (branchTips.find((b) => b.name === 'main')) getOrInitBranch('main');

          for (const commit of sortedCommits) {
            // ... existing branch determination logic ...
            const refs = refsByOid.get(commit.oid) || [];
            const branchRefs = refs.filter((r) => r.type === 'branch');
            // Collect ALL ref names for display
            const allRefNames = refs.map((r) => r.name);

            let targetBranchName = 'main';

            if (branchRefs.length > 0) {
              branchRefs.sort((a, b) => {
                const idxA = priority.indexOf(a.name);
                const idxB = priority.indexOf(b.name);
                if (idxA > -1 && idxB > -1) return idxA - idxB;
                if (idxA > -1) return -1;
                if (idxB > -1) return 1;
                return a.name.localeCompare(b.name);
              });
              targetBranchName = branchRefs[0].name;
            } else {
              if (commit.parents.length > 0) {
                const pOid = commit.parents[0];
                const parentBranchName = oidToBranchName.get(pOid);
                if (parentBranchName) targetBranchName = parentBranchName;
              }
            }

            oidToBranchName.set(commit.oid, targetBranchName);
            let branch = branchObjs.get(targetBranchName);

            if (!branch) {
              // ... create branch logic ...
              if (commit.parents.length > 0) {
                const pOid = commit.parents[0];
                const parentName = oidToBranchName.get(pOid) || 'main';
                const parentBranch = branchObjs.get(parentName);
                if (parentBranch) {
                  branch = parentBranch.branch(targetBranchName);
                } else {
                  branch = gitgraph.branch(targetBranchName);
                }
              } else {
                branch = gitgraph.branch(targetBranchName);
              }
              branchObjs.set(targetBranchName, branch);
            }

            // Prepare commit info
            const { subject, body } = buildCommitInfo(commit, allRefNames);

            const commitOptions = {
              subject,
              body,
              // tag: undefined, // Explicitly no tag
            };

            if (commit.parents.length > 1) {
              // Find the other branch
              const otherParentOid = commit.parents[1];
              const otherBranchName = oidToBranchName.get(otherParentOid);
              const otherBranch = otherBranchName ? branchObjs.get(otherBranchName) : undefined;

              if (otherBranch) {
                branch.merge({
                  branch: otherBranch,
                  commitOptions,
                });
              } else {
                // Fallback normal commit if can't find other branch
                branch.commit(commitOptions);
              }
            } else {
              branch.commit(commitOptions);
            }
          }
        }}
      </Gitgraph>
    </div>
  );
};
