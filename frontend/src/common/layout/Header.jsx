import { useNavigate } from 'react-router-dom';
import { logout } from '@/common/auth/authService';
import { APP_ROUTES } from '@/common/routing/routes';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

const Header = ({ backPath, isDetail = false }) => {
    const navigate = useNavigate();
    const handleLogout = () => {
        logout();
        navigate(APP_ROUTES.LOGIN, {
            replace: true,
        });
    };

    const handleBack = () => {
        navigate(backPath || -1);
    };

    return (
        <header className='shadow-lg px-8 bg-linear-to-br from-blue-900 to-blue-600'>
            <div className='max-w-7xl mx-auto flex items-center justify-between py-4'>
                <div className='flex items-center gap-4'>
                    {backPath && (
                        <>
                            <Button
                                onClick={handleBack}
                                className='inline-flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium bg-white/15 hover:bg-white/25 px-4 py-2 rounded-lg transition cursor-pointer border-none whitespace-nowrap'>
                                ← Danh sách
                            </Button>
                            <Separator
                                orientation='vertical'
                                className='bg-white/25'
                            />
                        </>
                    )}
                    <div className='text-white/70 text-xs uppercase tracking-widest'>
                        <span>
                            {isDetail ? 'Chi tiết' : 'Danh sách'} văn bản
                        </span>
                    </div>
                </div>
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger className='flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer hover:opacity-90 transition'>
                        <div className='flex items-center gap-2 bg-white/15 rounded-full px-4 py-1.5'>
                            <div className='w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center text-xs font-bold text-amber-900'>
                                AT
                            </div>
                            <span className='text-white text-sm font-medium'>
                                Admin
                            </span>
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='start' className='w-48'>
                        <DropdownMenuLabel>
                            <div className='flex items-center gap-2 px-1 py-1.5 text-left text-sm'>
                                <Avatar className=''>
                                    <AvatarImage src={''} alt={'avatar'} />
                                    <AvatarFallback className='bg-amber-400 text-amber-900 text-xs font-bold'>
                                        AT
                                    </AvatarFallback>
                                </Avatar>
                                <div className='grid flex-1 text-left text-sm leading-tight'>
                                    <span className='truncate font-medium text-black text-sm'>
                                        Admin
                                    </span>
                                </div>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem className='cursor-pointer'>
                                Tài khoản
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuGroup>
                            <DropdownMenuItem
                                onClick={handleLogout}
                                className='cursor-pointer'>
                                Đăng xuất
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
};

export default Header;
