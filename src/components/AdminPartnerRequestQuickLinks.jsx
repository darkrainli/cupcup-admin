import { Link } from 'react-router-dom'
import { FileText, Ticket } from 'lucide-react'

export default function AdminPartnerRequestQuickLinks() {
  return (
    <div className="flex items-center gap-2">
      <Link
        to="/admin/merchant-reviews"
        className="text-xs font-bold px-3 py-1.5 rounded-full bg-cc-warning-bg text-cc-warning hover:opacity-90 inline-flex items-center gap-1"
      >
        <FileText size={12} /> 商户资料审核
      </Link>
      <Link
        to="/admin/audit-activities"
        className="text-xs font-bold px-3 py-1.5 rounded-full bg-cc-success-bg text-cc-success hover:opacity-90 inline-flex items-center gap-1"
      >
        <Ticket size={12} /> 活动审核
      </Link>
    </div>
  )
}
