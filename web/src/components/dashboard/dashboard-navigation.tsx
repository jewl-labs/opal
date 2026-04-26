import {
  CircleDollarSignIcon,
  FilePlusCornerIcon,
  GavelIcon,
  Grid2x2Icon,
  OctagonAlertIcon,
} from 'lucide-react';
import { Button } from '../ui/button';

export default function DashboardNavigation() {
  return (
    <div className="fixed flex justify-center bottom-0 py-2 border-t border-dashed w-full inset-x-0">
      <Button
        variant="ghost"
        size="lg"
        className="text-primary flex items-center justify-start gap-2"
      >
        <Grid2x2Icon />
        <span>Overview</span>
      </Button>
      <Button
        variant="ghost"
        size="lg"
        className="flex items-center justify-start gap-2"
      >
        <FilePlusCornerIcon />
        <span>My Claims</span>
      </Button>
      <Button
        variant="ghost"
        size="lg"
        className="flex items-center justify-start gap-2"
      >
        <OctagonAlertIcon />
        <span>My Disputes</span>
      </Button>
      <Button
        variant="ghost"
        size="lg"
        className="flex items-center justify-start gap-2"
      >
        <GavelIcon />
        <span>Active Votes</span>
      </Button>
      <Button
        variant="ghost"
        size="lg"
        className="flex items-center justify-start gap-2"
      >
        <CircleDollarSignIcon />
        <span>Earnings</span>
      </Button>
    </div>
  );
}
