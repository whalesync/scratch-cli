/* eslint-disable react/display-name */
import { Anchor, Box, Text } from '@mantine/core';
import React, { JSX } from 'react';
import ReactMarkdown, { Options } from 'react-markdown';

export const MarkdownRenderer = (props: Options): JSX.Element => {
  const { components, children, ...rest } = props;

  return (
    <ReactMarkdown
      {...rest}
      components={{
        p: React.forwardRef<HTMLParagraphElement, React.ComponentProps<typeof Text>>(({ ...props }, ref) => (
          <Text lh={1.5} fw="inherit" fz="inherit" ref={ref} {...props} />
        )),
        a: React.forwardRef<HTMLAnchorElement, React.ComponentProps<typeof Anchor>>((props, ref) => {
          return <Anchor lh={1} target="_blank" ref={ref} {...props} />;
        }),
        strong: React.forwardRef<HTMLSpanElement, React.ComponentProps<typeof Box>>((props, ref) => {
          return <Box lh={1} ref={ref} component="span" fw={550} {...props} />;
        }),
        ...(components || {}),
      }}
    >
      {children}
    </ReactMarkdown>
  );
};
