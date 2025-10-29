'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'

interface ImageUploadProps {
  currentImageUrl?: string | null
  onImageSelect: (file: File) => void
  onImageRemove?: () => void
}

export default function ImageUpload({
  currentImageUrl,
  onImageSelect,
  onImageRemove,
}: ImageUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentImageUrl || null
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 이미지 파일만 허용
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.')
      return
    }

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하만 가능합니다.')
      return
    }

    // 미리보기 URL 생성
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    // 부모 컴포넌트에 파일 전달
    onImageSelect(file)
  }

  const handleRemove = () => {
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onImageRemove?.()
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {/* 이미지 미리보기 */}
        <div
          className="relative w-32 h-32 rounded-lg border-2 border-dashed border-gray-300 overflow-hidden cursor-pointer hover:border-blue-500 transition-colors"
          onClick={handleClick}
        >
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt="학생 사진"
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <svg
                className="w-8 h-8 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-sm">사진 추가</span>
            </div>
          )}
        </div>

        {/* 버튼들 */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {previewUrl ? '사진 변경' : '사진 업로드'}
          </button>
          {previewUrl && (
            <button
              type="button"
              onClick={handleRemove}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              사진 제거
            </button>
          )}
        </div>
      </div>

      {/* 숨겨진 파일 input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <p className="text-sm text-gray-500">
        JPG, PNG, GIF 파일 (최대 5MB)
      </p>
    </div>
  )
}
