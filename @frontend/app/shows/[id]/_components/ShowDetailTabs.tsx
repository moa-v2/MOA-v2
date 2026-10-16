'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/atoms/tabs';
import Image from 'next/image';
import { SHOW_DETAIL_NOTICE_TEXT, SHOW_DETAIL_SALES_INFO_TEXT } from '@/constants/shows/details';

interface Props {
  show: ShowCatalog.Detail;
}

function Paragraphs({ text }: { text: string }) {
  return (
    <div className="text-foreground text-sm leading-relaxed whitespace-pre-line">
      {text.split(/\n\n+/).map((paragraph, i) => (
        <p key={i} className="mb-3 last:mb-0">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

export default function ShowDetailTabs({ show }: Props) {
  const details = show?.detailImageUrls ?? [];

  return (
    <Tabs defaultValue="detail" className="w-full">
      <TabsList variant="line" className="w-full border-b bg-transparent">
        <TabsTrigger value="detail">공연정보</TabsTrigger>
        <TabsTrigger value="booking">판매정보</TabsTrigger>
      </TabsList>
      <TabsContent value="detail" className="rounded-b border border-t-0 p-4">
        <div className="space-y-8">
          <section>
            <h3 className="mb-3 text-base font-semibold">공지사항</h3>
            <Paragraphs text={SHOW_DETAIL_NOTICE_TEXT} />
          </section>
          <section>
            <h3 className="mb-3 text-base font-semibold">상세정보</h3>
            {details.length > 0 ? (
              <div className="space-y-3">
                {details.map((url, i) => (
                  <div key={i} className="bg-muted relative w-full overflow-hidden rounded-lg">
                    <Image
                      src={url}
                      alt={`detail ${i + 1}`}
                      width={800}
                      height={600}
                      className="h-auto w-full object-contain"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">등록된 상세정보가 없습니다.</p>
            )}
          </section>
        </div>
      </TabsContent>

      <TabsContent value="booking" className="rounded-b border border-t-0 p-4">
        <div className="space-y-8">
          <section>
            <h3 className="mb-3 text-base font-semibold">예매 유의사항</h3>
            <Paragraphs text={SHOW_DETAIL_SALES_INFO_TEXT.notice} />
          </section>
          <section>
            <h3 className="mb-3 text-base font-semibold">티켓 수령 안내</h3>
            <Paragraphs text={SHOW_DETAIL_SALES_INFO_TEXT.ticket} />
          </section>
          <section>
            <h3 className="mb-3 text-base font-semibold">예매 취소 시 유의사항</h3>
            <Paragraphs text={SHOW_DETAIL_SALES_INFO_TEXT.cancel} />
          </section>
          <section>
            <h3 className="mb-3 text-base font-semibold">환불안내</h3>
            <Paragraphs text={SHOW_DETAIL_SALES_INFO_TEXT.refund} />
          </section>
          <section>
            <h3 className="mb-3 text-base font-semibold">무통장입금 시 주의사항</h3>
            <Paragraphs text={SHOW_DETAIL_SALES_INFO_TEXT.transfer} />
          </section>
        </div>
      </TabsContent>
    </Tabs>
  );
}
