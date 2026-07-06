import { motion } from 'motion/react';
import { CheckCircle, AlertCircle, AlertTriangle, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning';

export interface NotificationProps {
  message: string;
  type: NotificationType;
  onClose: () => void;
}

export default function Notification({ message, type, onClose }: NotificationProps) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-lime-300" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-300" />,
  };

  const accent = {
    success: 'border-lime-400/60 shadow-[0_0_20px_-4px_rgba(198,242,78,0.5)]',
    error: 'border-red-500/60 shadow-[0_0_20px_-4px_rgba(248,113,113,0.5)]',
    warning: 'border-amber-400/60 shadow-[0_0_20px_-4px_rgba(251,191,36,0.5)]',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`fixed top-4 right-4 z-50 bg-[#0b0f14] border ${accent[type]} rounded-none px-4 py-3 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-100`}
    >
      {icons[type]}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 text-slate-500 hover:text-lime-300 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
