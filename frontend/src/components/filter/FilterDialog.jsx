import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogOverlay,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Funnel } from 'lucide-react';

const FilterDialog = ({ children, handleFilters, handleOpenFilters }) => {
    return (
        <Dialog modal={true}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                        <Button onClick={handleOpenFilters}>
                            <Funnel size={12} />
                        </Button>
                    </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent side='bottom'>
                    <p>Bộ lọc</p>
                </TooltipContent>
            </Tooltip>
            <DialogOverlay className='bg-black/50 backdrop-blur-sm' />
            <DialogContent className='max-w-lg w-full data-[state=open]:zoom-in-100! data-[state=open]:slide-in-from-bottom-20 data-[state=open]:duration-600'>
                <DialogHeader>
                    <DialogTitle className='flex gap-2 items-center'>
                        <Funnel size={12} />
                        <span>Bộ lọc</span>
                    </DialogTitle>
                    <DialogDescription className='sr-only'>
                        Bộ lọc
                    </DialogDescription>
                </DialogHeader>
                {children}
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant='outline'>Hủy</Button>
                    </DialogClose>
                    <DialogClose asChild>
                        <Button onClick={handleFilters}>Tìm kiếm</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default FilterDialog;
