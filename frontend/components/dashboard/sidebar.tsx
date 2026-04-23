import {
    CircleDollarSignIcon,
    FilePlusCornerIcon,
    GavelIcon,
    Grid2x2Icon,
    OctagonAlertIcon,
} from 'lucide-react';
import { Button } from '../ui/button';

export default function DashboardSidebar() {
    return (
        <div className="fixed h-screen w-52 py-4 px-2">
            <div className="z-10 flex h-full w-full flex-col justify-between gap-1 pt-16">
                <div></div>
                <div className="flex w-full flex-col">
                    <Button
                        variant="ghost"
                        size="lg"
                        className="flex items-center justify-start gap-2 text-primary"
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
            </div>
        </div>
    );
}
