import { ModalWrapper } from '@/app/components/ModalWrapper';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { workbookApi } from '@/lib/api/workbook';
import { Gitgraph, templateExtend, TemplateName } from '@gitgraph/react';
import { Loader, ScrollArea, Text } from '@mantine/core';
import { WorkbookId } from '@spinner/shared-types';
import { useEffect, useRef, useState } from 'react';

// Helper to build commit info
const buildCommitInfo = (commit: CommitData, branchName?: string) => {
  const msg = commit.message.trim().split('\n')[0];
  const line1 = branchName ? `${commit.oid.substring(0, 7)} [${branchName}]` : commit.oid.substring(0, 7);
  return { subject: line1, body: msg };
};
interface GitGraphModalProps {
  workbookId: WorkbookId;
  isOpen: boolean;
  onClose: () => void;
}

interface CommitData {
  oid: string;
  message: string;
  parents: string[];
  author: { name: string; email: string; timestamp: number };
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

  return (
    <ModalWrapper
      title="Git Graph"
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

  // Build ref lookup by oid
  const refsByOid = new Map<string, RefData[]>();
  data.refs.forEach((r) => {
    const list = refsByOid.get(r.oid) || [];
    list.push(r);
    refsByOid.set(r.oid, list);
  });

  // Find main and dirty branch tips
  const mainRef = data.refs.find((r) => r.name === 'main');
  const dirtyRef = data.refs.find((r) => r.name === 'dirty');

  return (
    <div style={{ padding: 20 }}>
      <Gitgraph
        options={{
          template: templateExtend(TemplateName.Metro, {
            colors: ['#0088CC', '#27ae60'],
            branch: {
              lineWidth: 2,
              spacing: 30, // horizontal spacing
              label: {
                font: '10px sans-serif',
                borderRadius: 4,
              },
            },
            commit: {
              spacing: 18, // vertical spacing
              dot: {
                size: 6,
              },

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
          // Only populate once per component mount
          if (hasPopulatedRef.current) {
            return;
          }
          hasPopulatedRef.current = true;

          // Build commit map
          const commitMap = new Map<string, CommitData>();
          data.commits.forEach((c) => commitMap.set(c.oid, c));

          // Sort commits by timestamp (oldest first for proper graph building)
          const sortedCommits = [...data.commits].sort((a, b) => a.author.timestamp - b.author.timestamp);

          // Create main branch (hide label since we'll show it in commit msg)
          const main = gitgraph.branch({ name: 'main', style: { label: { display: false } } });

          // Find where main branch tip is
          const mainTipOid = mainRef?.oid;

          // Track which commits we've added
          const addedCommits = new Set<string>();

          // Add commits to main branch up to main tip
          for (const c of sortedCommits) {
            const refs = refsByOid.get(c.oid) || [];
            const tagNames = refs.filter((r) => r.type === 'tag').map((r) => r.name);
            const isMainTip = c.oid === mainTipOid;

            const { subject, body } = buildCommitInfo(c, isMainTip ? 'main' : undefined);

            main.commit({
              subject,
              body,
              tag: tagNames.length > 0 ? tagNames.join(', ') : undefined,
            });
            addedCommits.add(c.oid);

            // If this is the main tip and dirty exists, create dirty branch
            if (isMainTip && dirtyRef) {
              const dirty = main.branch({ name: 'dirty', style: { label: { display: false } } });

              // Add remaining commits to dirty branch
              const remainingCommits = sortedCommits.filter((rc) => !addedCommits.has(rc.oid));
              for (const dc of remainingCommits) {
                const dcRefs = refsByOid.get(dc.oid) || [];
                const dcTags = dcRefs.filter((r) => r.type === 'tag').map((r) => r.name);
                const isDirtyTip = dc.oid === dirtyRef.oid;

                const { subject: dcSubject, body: dcBody } = buildCommitInfo(dc, isDirtyTip ? 'dirty' : undefined);

                dirty.commit({
                  subject: dcSubject,
                  body: dcBody,
                  tag: dcTags.length > 0 ? dcTags.join(', ') : undefined,
                });
                addedCommits.add(dc.oid);
              }
              break;
            }
          }
        }}
      </Gitgraph>
    </div>
  );
};
