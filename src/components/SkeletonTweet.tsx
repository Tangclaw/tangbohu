export default function SkeletonTweet() {
 return (
 <div className="border-b border-gray-200 p-4">
 <div className="flex gap-4">
 <div className="h-12 w-12 animate-shimmer rounded-full" />
 <div className="flex-1 space-y-3">
 <div className="flex items-center gap-2">
 <div className="h-4 w-20 animate-shimmer rounded" />
 <div className="h-3 w-16 animate-shimmer rounded" />
 <div className="h-3 w-12 animate-shimmer rounded" />
 </div>
 <div className="space-y-2">
 <div className="h-4 w-full animate-shimmer rounded" />
 <div className="h-4 w-4/5 animate-shimmer rounded" />
 </div>
 <div className="flex items-center gap-8 pt-1">
 <div className="h-4 w-10 animate-shimmer rounded" />
 <div className="h-4 w-10 animate-shimmer rounded" />
 <div className="h-4 w-10 animate-shimmer rounded" />
 <div className="h-4 w-10 animate-shimmer rounded" />
 </div>
 </div>
 </div>
 </div>
 )
}
