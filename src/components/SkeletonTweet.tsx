export default function SkeletonTweet() {
  return (
    <div className="border-b border-gray-100 p-4">
      <div className="flex gap-4">
        <div className="h-12 w-12 flex-shrink-0 animate-shimmer rounded-full bg-gray-100" />
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-20 animate-shimmer rounded-md bg-gray-100" />
            <div className="h-3 w-16 animate-shimmer rounded-md bg-gray-100" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full animate-shimmer rounded-md bg-gray-100" />
            <div className="h-4 w-3/4 animate-shimmer rounded-md bg-gray-100" />
          </div>
          <div className="flex items-center gap-6 pt-1">
            <div className="h-4 w-12 animate-shimmer rounded-md bg-gray-100" />
            <div className="h-4 w-12 animate-shimmer rounded-md bg-gray-100" />
            <div className="h-4 w-12 animate-shimmer rounded-md bg-gray-100" />
            <div className="h-4 w-12 animate-shimmer rounded-md bg-gray-100" />
          </div>
        </div>
      </div>
    </div>
  )
}
