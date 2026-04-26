import Container from '@/components/common/container';
import Header from '@/components/statements/feed-header';
import type { StatementCardProps } from '@/components/statements/statement-card';
import StatemenrCard from '@/components/statements/statement-card';
import { STATEMENT_DATA } from '@/lib/constants';
import { useState } from 'react';

export default function StatementsFeed() {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statements, setStatements] = useState<StatementCardProps[]>([
    ...STATEMENT_DATA,
  ]);

  const handleToggleSort = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    setStatements((prev: StatementCardProps[]) =>
      [...prev].sort((a, b) =>
        newOrder === 'asc' ? a.bond - b.bond : b.bond - a.bond,
      ),
    );
  };
  return (
    <Container className="border-muted-foreground/50 border-x border-dashed pt-16">
      <Header sortOrder={sortOrder} onToggleSort={handleToggleSort} />
      <div className="grid grid-cols-1 gap-4 px-4 py-24">
        {statements.map((data) => (
          <StatemenrCard key={data.id} {...data} />
        ))}
      </div>
    </Container>
  );
}
