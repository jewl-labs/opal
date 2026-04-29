'use client';

import { useState } from 'react';

import Container from '@/components/common/container';
import Header from '@/components/statements/feed-header';
import StatementCard from '@/components/statements/statement-card';
import { STATEMENTS } from '@/data/statements';

export default function Statements() {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statements, setStatements] = useState([...STATEMENTS]);

  const handleToggleSort = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    setStatements((prev) =>
      [...prev].sort((a, b) =>
        newOrder === 'asc'
          ? a.bondAmountPUSD - b.bondAmountPUSD
          : b.bondAmountPUSD - a.bondAmountPUSD
      )
    );
  };
  return (
    <Container className="border-muted-foreground/50 border-x border-dashed">
      <Header sortOrder={sortOrder} onToggleSort={handleToggleSort} />
      <div className="grid grid-cols-1 gap-4 px-4 pt-24 pb-8">
        {statements.map((data) => (
          <StatementCard key={data.id} {...data} />
        ))}
      </div>
    </Container>
  );
}
