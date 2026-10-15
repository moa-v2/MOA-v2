'use client';

import { Button, Skeleton } from '@/components/atoms';
import {
  FormField,
  FormFileField,
  FormInputField,
  FormScheduleTableField,
  FormSelectField,
} from '@/components/molecules';
import { useAlert } from '@/components/molecules/AlertContext';
import { ERROR_MESSAGES, SHOW_FORM_FIELDS } from '@/constants/admin/show';
import { GENRE_OPTIONS, REGION_OPTIONS } from '@/constants/common';
import { DATE_FORMAT, DATE_UNIT } from '@/constants/common/dateFormat';
import { ADMIN_ROUTES } from '@/constants/route/adminRoutes';
import { createShow, getShow, updateShow } from '@/lib/api/admin/show';
import { stringToDate } from '@/lib/common/date';
import dayjs from '@/plugins/dayjs';
import { zodResolver } from '@hookform/resolvers/zod';
import { Genre, Region } from '@shared/enums';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FieldErrors, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { PageCard } from '@/components/molecules/PageCard';
import StatusBadge from '@/components/molecules/StatusBadge';
import { getSeatMapList } from '@/lib/api/admin/seat';
import { useAuth } from '@/lib/auth/AuthContext';
import { loadDraft, removeDraft, saveDraft } from '@/lib/form-draft';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';

interface Props {
  id?: string;
}
type ActionType = '입력' | '선택';

// 등록 화면 임시저장: 3일 지나면 묻지 않고 지우고, 입력을 멈추고 1초 뒤 자동 저장
const DRAFT_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const DRAFT_SAVE_DELAY_MS = 1000;
const DRAFT_IMAGE_WARNING = '첨부한 이미지는 저장되지 않습니다.';

// 공연 일정 중에서 첫 번째 공연 시각(날짜+시간)을 찾는 함수
function getFirstShowDateTime(schedules?: Show.Schedules[]) {
  if (!schedules?.length) return null;

  const dateTimes = schedules
    .filter((s) => s.showDate && dayjs(s.showDate).isValid())
    .map((s) => (s.showTime ? dayjs(`${s.showDate}T${s.showTime}`) : dayjs(s.showDate)));

  if (!dateTimes?.length) return null;

  return dateTimes.reduce((earliest, current) => (current.isBefore(earliest) ? current : earliest));
}

const requiredStringSchema = (field: string, action: ActionType) =>
  z.string().min(1, `${field}을(를) ${action}하세요.`);

const dateTimeSchema = (field: string) =>
  requiredStringSchema(field, '입력').refine((str) => dayjs(str).isValid(), {
    message: ERROR_MESSAGES.NOT_VALID_FORMAT,
  });

const timeSchema = (field: string) =>
  requiredStringSchema(field, '입력').regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: ERROR_MESSAGES.NOT_VALID_FORMAT,
  });

const scheduleSchema = z
  .object({
    [SHOW_FORM_FIELDS.SHOW_DATE]: dateTimeSchema('공연일'),
    [SHOW_FORM_FIELDS.SHOW_TIME]: timeSchema('공연 시간'),
    [SHOW_FORM_FIELDS.TICKET_OPEN_TIME]: dateTimeSchema('티켓 오픈일'),
    [SHOW_FORM_FIELDS.SCHEDULE_ID]: z.number().optional(),
  })
  .refine(
    (s) => {
      // 공연일과 공연시간이 모두 입력되어야 비교 가능
      if (!s.showDate || !s.showTime || !s.ticketOpenTime) {
        return true; // 다른 필드 입력시 처리
      }

      // 공연일 + 공연시간 조합
      const showDateTime = dayjs(`${s.showDate}T${s.showTime}`);
      const ticketOpenDateTime = dayjs(s.ticketOpenTime);

      // 티켓 오픈일이 공연일+시간보다 이전이어야 함
      return ticketOpenDateTime.isBefore(showDateTime);
    },
    {
      message: '티켓 오픈일은 공연일보다 이전이어야 합니다.',
      path: [SHOW_FORM_FIELDS.TICKET_OPEN_TIME],
    },
  );

const showFormSchema = z
  .object({
    [SHOW_FORM_FIELDS.TITLE]: requiredStringSchema('제목', '입력').max(
      100,
      '제목은 100자 이내로 입력하세요.',
    ),
    [SHOW_FORM_FIELDS.GENRE]: requiredStringSchema('장르', '선택'),
    [SHOW_FORM_FIELDS.REGION]: requiredStringSchema('지역', '선택'),
    [SHOW_FORM_FIELDS.VENUE_NAME]: requiredStringSchema('장소', '선택'),
    [SHOW_FORM_FIELDS.HALL_NAME]: requiredStringSchema('공연장', '선택'),
    [SHOW_FORM_FIELDS.RUNNING_TIME]: requiredStringSchema('관람 시간', '입력').regex(
      /^\d+분$/,
      '분 단위로 입력하세요. (ex. 100분)',
    ),
    [SHOW_FORM_FIELDS.CAST]: requiredStringSchema('출연진', '입력').max(
      500,
      '출연진은 500자 이내로 입력하세요.',
    ),
    [SHOW_FORM_FIELDS.START_DATE]: dateTimeSchema('예매 시작일'),
    [SHOW_FORM_FIELDS.END_DATE]: z.string(),
    [SHOW_FORM_FIELDS.SCHEDULES]: z.array(scheduleSchema),
  })
  .refine(
    (form) => {
      // 예매 시작일과 일정이 모두 입력되어야 비교 가능
      if (!form.startDate || !form.schedules || form.schedules.length === 0) {
        return true; // 다른 필드 입력시 처리
      }

      const firstShowDateTime = getFirstShowDateTime(form.schedules as Show.Schedules[]);
      if (!firstShowDateTime) {
        return true; // 공연일·시간이 입력되지 않았으면 우선 리턴
      }

      const startDateTime = dayjs(form.startDate);

      // 예매 시작일이 첫 공연 시간보다 이전이어야 함
      return startDateTime.isBefore(firstShowDateTime);
    },
    {
      message: ERROR_MESSAGES.START_DATE_EARLY,
      path: [SHOW_FORM_FIELDS.START_DATE],
    },
  );
export type ShowFormData = z.infer<typeof showFormSchema>;

export default function ShowUpsertForm(props: Props) {
  const router = useRouter();
  const { confirm } = useAlert();
  const { user } = useAuth();

  const showId = Number(props.id) || -1;
  const isUpdate = !!showId && showId > 0;
  const flag = isUpdate ? '수정' : '등록';

  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(getShow(showId));

  const { mutateAsync: onCreateShow, isPending: createPending } = useMutation(createShow());
  const { mutateAsync: onUpdateShow, isPending: updatePending } = useMutation(updateShow(showId));

  const loading = isLoading || createPending || updatePending;

  const [mounted, setMounted] = useState(false);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [detailFiles, setDetailFiles] = useState<File[]>([]);
  const [deletedScheduleIds, setDeletedScheduleIds] = useState<number[]>([]);
  const [deletedDetailImageIds, setDeletedDetailImageIds] = useState<number[]>([]);
  // 불러온 장소·공연장(수정 화면은 서버 값, 등록 화면은 임시저장). 좌석 목록이 온 뒤 한 번 채움
  const [pendingLocation, setPendingLocation] = useState<Pick<
    ShowFormData,
    'region' | 'venueName' | 'hallName'
  > | null>(null);

  // 임시저장(등록 화면만, 관리자 계정별)
  const draftKey = !isUpdate && user?.email ? `show-create:${user.email}` : null;
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const draftAskedRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);

  function createEmptySchedule() {
    return {
      [SHOW_FORM_FIELDS.SHOW_DATE]: '',
      [SHOW_FORM_FIELDS.SHOW_TIME]: '',
      [SHOW_FORM_FIELDS.TICKET_OPEN_TIME]: '',
      [SHOW_FORM_FIELDS.RESERVATION_COUNT]: 0,
    };
  }

  function getDefaultValues(): ShowFormData {
    return {
      [SHOW_FORM_FIELDS.TITLE]: '',
      [SHOW_FORM_FIELDS.GENRE]: '',
      [SHOW_FORM_FIELDS.REGION]: '',
      [SHOW_FORM_FIELDS.VENUE_NAME]: '',
      [SHOW_FORM_FIELDS.HALL_NAME]: '',
      [SHOW_FORM_FIELDS.RUNNING_TIME]: '',
      [SHOW_FORM_FIELDS.CAST]: '',
      [SHOW_FORM_FIELDS.START_DATE]: '',
      [SHOW_FORM_FIELDS.END_DATE]: '',
      [SHOW_FORM_FIELDS.SCHEDULES]: [createEmptySchedule()],
    };
  }

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    setError,
    clearErrors,
    reset,
    resetField,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ShowFormData>({
    resolver: zodResolver(showFormSchema),
    defaultValues: getDefaultValues(),
    mode: 'onChange', // 필드 변경 시 자동 검증
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: SHOW_FORM_FIELDS.SCHEDULES,
  });

  const watchedRegion = useWatch({ control, name: SHOW_FORM_FIELDS.REGION });
  const watchedVenueName = useWatch({ control, name: SHOW_FORM_FIELDS.VENUE_NAME });
  const watchedHallName = useWatch({ control, name: SHOW_FORM_FIELDS.HALL_NAME });

  // 좌석 목록 api
  const seatMapParams = useMemo(
    () => ({ region: watchedRegion ?? '', page: 0, size: 100 }),
    [watchedRegion],
  );
  const { data: seatMapListResponse, isFetching: isSeatMapFetching } = useQuery({
    ...getSeatMapList(seatMapParams),
    enabled: !!watchedRegion,
  });
  const seatMapList = useMemo(
    () => seatMapListResponse?.content ?? [],
    [seatMapListResponse?.content],
  );

  // 장소 목록
  const venueOptions = useMemo(() => {
    const names = [...new Set(seatMapList.map((item) => item.venueName).filter(Boolean))];
    return names.map((name) => ({ label: name, value: name }));
  }, [seatMapList]);

  // 공연장 목록
  const hallOptions = useMemo(() => {
    if (!watchedRegion || !watchedVenueName) return [];
    const filtered = seatMapList.filter(
      (item) => item.region === watchedRegion && item.venueName === watchedVenueName,
    );
    const names = [...new Set(filtered.map((item) => item.hallName).filter(Boolean))];
    return names.map((name) => ({ label: name, value: name }));
  }, [seatMapList, watchedRegion, watchedVenueName]);

  // 장소 placeholder
  const venuePlaceholder = useMemo(() => {
    if (!watchedRegion) return '지역을 먼저 선택하세요.';
    return '장소를 선택하세요.';
  }, [watchedRegion]);

  // 공연장 placeholder
  const hallPlaceholder = useMemo(() => {
    if (!watchedVenueName) return '장소를 먼저 선택하세요.';
    return '공연장을 선택하세요.';
  }, [watchedVenueName]);

  // 지역 또는 장소 선택 변경시 초기화
  useEffect(() => {
    const venueValues = venueOptions.map((o) => o.value);
    if (watchedVenueName && !venueValues.includes(watchedVenueName)) {
      setValue(SHOW_FORM_FIELDS.VENUE_NAME, '');
      setValue(SHOW_FORM_FIELDS.HALL_NAME, '');
    }
  }, [venueOptions, watchedVenueName, setValue]);

  useEffect(() => {
    const hallValues = hallOptions.map((o) => o.value);
    if (watchedHallName && !hallValues.includes(watchedHallName)) {
      setValue(SHOW_FORM_FIELDS.HALL_NAME, '');
    }
  }, [hallOptions, watchedHallName, setValue]);

  // 리액트 하이드레이션 무한 루프 방지용 마운트 플래그
  useEffect(() => {
    setMounted(true);
  }, []);

  // 수정인 경우 데이터 로드 후 폼 초기화
  useEffect(() => {
    if (!isUpdate || !data) return;

    const formSchedules =
      data.schedules.length > 0
        ? data.schedules.map((schedule: Show.Schedules) => ({
            [SHOW_FORM_FIELDS.SCHEDULE_ID]: schedule.scheduleId,
            [SHOW_FORM_FIELDS.SHOW_DATE]: schedule.showDate,
            [SHOW_FORM_FIELDS.SHOW_TIME]: schedule.showTime,
            [SHOW_FORM_FIELDS.TICKET_OPEN_TIME]: schedule.ticketOpenTime.slice(0, 16),
            [SHOW_FORM_FIELDS.RESERVATION_COUNT]: schedule.reservationCount,
          }))
        : [createEmptySchedule()];

    const formValues = {
      [SHOW_FORM_FIELDS.TITLE]: data.title,
      [SHOW_FORM_FIELDS.GENRE]: data.genre,
      [SHOW_FORM_FIELDS.REGION]: data.region,
      [SHOW_FORM_FIELDS.VENUE_NAME]: data.venueName,
      [SHOW_FORM_FIELDS.HALL_NAME]: data.hallName,
      [SHOW_FORM_FIELDS.RUNNING_TIME]: data.runningTime,
      [SHOW_FORM_FIELDS.CAST]: data.cast,
      [SHOW_FORM_FIELDS.START_DATE]: data.saleStartDate.slice(0, 16),
      [SHOW_FORM_FIELDS.SCHEDULES]: formSchedules,
    };

    // Controller가 마운트된 후 reset 실행
    requestAnimationFrame(() => {
      reset(formValues, {
        keepDefaultValues: false,
        keepDirty: false,
        keepErrors: false,
      });
      // 장소·공연장은 선택지가 나온 뒤 아래 effect 가 채움(바뀐 입력으로 치지 않도록 shouldDirty 없이 비움)
      setValue(SHOW_FORM_FIELDS.VENUE_NAME, '');
      setValue(SHOW_FORM_FIELDS.HALL_NAME, '');
      setPendingLocation({
        region: data.region,
        venueName: data.venueName,
        hallName: data.hallName,
      });
    });
  }, [isUpdate, data, reset, setValue]);

  // 등록 화면에 들어오면 임시저장을 불러올지 한 번 물어봄
  useEffect(() => {
    if (!mounted || !draftKey || draftAskedRef.current) return;
    draftAskedRef.current = true;

    const draft = loadDraft<ShowFormData>(draftKey, DRAFT_MAX_AGE_MS);
    if (!draft) {
      setDraftReady(true);
      return;
    }
    void confirm({
      title: '임시 저장',
      description: `${dayjs(draft.savedAt).format('M월 D일 HH:mm')}에 작성하던 공연이 있습니다. 이어서 작성할까요?`,
      warning: DRAFT_IMAGE_WARNING,
      confirmText: '이어서 작성',
      cancelText: '새로 작성',
    }).then((resume) => {
      if (resume) {
        // 기본값(빈 폼)은 그대로 둬야 불러온 내용이 '바뀐 입력'으로 남아 이탈 경고가 걸림
        // 장소·공연장은 선택지가 나온 뒤에 아래 effect 가 채움
        reset({ ...draft.values, venueName: '', hallName: '' }, { keepDefaultValues: true });
        const { region, venueName, hallName } = draft.values;
        setPendingLocation({ region, venueName, hallName });
        setDraftSavedAt(draft.savedAt);
      } else {
        removeDraft(draftKey);
      }
      setDraftReady(true);
    });
  }, [mounted, draftKey, confirm, reset]);

  // 불러온 지역의 좌석 목록이 온 뒤에 장소 → 공연장 순서로 한 번 채우고 끝냄(이후 사용자가 바꾼 값은 그대로 둠)
  // 선택 상자는 선택지와 값이 같은 순간에 들어오면 값을 버리므로, 선택지가 나온 다음 렌더에서 넣음
  useEffect(() => {
    if (!pendingLocation || isSeatMapFetching || watchedRegion !== pendingLocation.region) return;
    const { venueName, hallName } = pendingLocation;
    // 그사이 없어진 장소·공연장이면 비워 둔 채 끝냄
    if (!venueOptions.some((option) => option.value === venueName)) {
      setPendingLocation(null);
      return;
    }
    if (watchedVenueName !== venueName) {
      setValue(SHOW_FORM_FIELDS.VENUE_NAME, venueName, { shouldDirty: true, shouldValidate: true });
      return;
    }
    if (!hallOptions.some((option) => option.value === hallName)) {
      setPendingLocation(null);
      return;
    }
    if (watchedHallName !== hallName) {
      setValue(SHOW_FORM_FIELDS.HALL_NAME, hallName, { shouldDirty: true, shouldValidate: true });
      return;
    }
    setPendingLocation(null);
  }, [
    pendingLocation,
    isSeatMapFetching,
    watchedRegion,
    watchedVenueName,
    watchedHallName,
    venueOptions,
    hallOptions,
    setValue,
  ]);

  // 입력을 멈추고 잠시 뒤 자동 임시저장. 빈 폼으로 돌아가면 지움
  const formValues = useWatch({ control });
  useEffect(() => {
    if (!draftKey || !draftReady || pendingLocation || submitted) return;
    const timer = setTimeout(() => {
      if (isDirty) {
        setDraftSavedAt(saveDraft(draftKey, formValues));
      } else {
        removeDraft(draftKey);
        setDraftSavedAt(null);
      }
    }, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draftKey, draftReady, pendingLocation, submitted, formValues, isDirty]);

  function handleSaveDraft() {
    if (draftKey) setDraftSavedAt(saveDraft(draftKey, getValues()));
  }

  // 저장하지 않은 입력이 있으면 나가기 전에 확인
  const hasNewFiles = !!posterFile || detailFiles.length > 0;
  const hasChanges =
    isDirty || hasNewFiles || deletedScheduleIds.length > 0 || deletedDetailImageIds.length > 0;
  const { confirmLeave } = useLeaveGuard(
    hasChanges,
    isUpdate
      ? '저장하지 않은 변경 사항은 사라집니다. 나가시겠습니까?'
      : '작성 중인 내용은 임시저장되어 다음에 이어서 작성할 수 있습니다. 나가시겠습니까?',
    isUpdate ? undefined : DRAFT_IMAGE_WARNING,
  );

  // 수정일 때 상태 체크
  // - WAITING: 모든 필드 수정 가능
  // - ON_SALE 이후
  //  1. 장르, 장소, 예매 시작일 수정 불가
  //  1. 일정: 해당 회차 예매된 좌석 있는 경우 수정 불가
  const isDisabledEdit = useMemo(() => {
    // 생성인 경우 모두 수정 가능
    if (!isUpdate) return false;

    // 수정인 경우 데이터 불러오는 중인 경우 대기
    if (!data) return true;

    return data.status !== 'WAITING';
  }, [isUpdate, data]);

  // 일정 및 예매 시작일 변경 감지
  const [schedules, startDate] = useWatch({
    control,
    name: [SHOW_FORM_FIELDS.SCHEDULES, SHOW_FORM_FIELDS.START_DATE],
  });

  // 1. 공연 일정 중복 검증
  const hasDuplicateSchedule = useMemo(() => {
    if (!schedules || schedules.length === 0) return false;

    const seen = new Set<string>();
    for (const schedule of schedules) {
      if (!schedule.showDate || !schedule.showTime) continue;
      const key = `${schedule.showDate}_${schedule.showTime}`;
      if (seen.has(key)) return true;
      seen.add(key);
    }
    return false;
  }, [schedules]);

  useEffect(() => {
    if (hasDuplicateSchedule) {
      setError(SHOW_FORM_FIELDS.SCHEDULES, {
        type: 'manual',
        message: '중복된 공연 일정이 있습니다.',
      });
    } else {
      clearErrors(SHOW_FORM_FIELDS.SCHEDULES);
    }
  }, [hasDuplicateSchedule, setError, clearErrors]);

  // 2. 예매 시작일 또는 첫 번째 공연일이 변경될 때 재검증
  const firstShowDateTimeStr = useMemo(() => {
    const first = getFirstShowDateTime(schedules as Show.Schedules[]);
    return first ? first.format(DATE_FORMAT.FULL_TIMEZONE) : null;
  }, [schedules]);

  useEffect(() => {
    if (!startDate || !firstShowDateTimeStr) {
      clearErrors(SHOW_FORM_FIELDS.START_DATE);
      return;
    }

    // 예매 시작일 재검증
    const startDateTime = dayjs(startDate);
    const firstShowDateTime = dayjs(firstShowDateTimeStr);
    const isValid = startDateTime.isBefore(firstShowDateTime);

    if (!isValid) {
      setError(SHOW_FORM_FIELDS.START_DATE, {
        type: 'manual',
        message: ERROR_MESSAGES.START_DATE_EARLY,
      });
    } else {
      clearErrors(SHOW_FORM_FIELDS.START_DATE);
    }
  }, [startDate, firstShowDateTimeStr, setError, clearErrors]);

  // 3. 일정 공연일이 변경될 때 endDate 설정 (마지막 공연의 2시간 전)
  // 일정에서 계산하는 값이라 바뀐 입력으로 치지 않도록 기본값도 함께 바꿈(수정 화면을 열기만 해도 이탈 경고가 뜨지 않게)
  useEffect(() => {
    const dateTimes = (schedules ?? [])
      .filter((s) => s.showDate && dayjs(s.showDate).isValid())
      .map((s) => (s.showTime ? dayjs(`${s.showDate}T${s.showTime}`) : dayjs(s.showDate)));

    if (dateTimes.length === 0) {
      resetField(SHOW_FORM_FIELDS.END_DATE, { defaultValue: '' });
      return;
    }

    const lastShowDateTime = dateTimes.reduce((latest, current) =>
      current.isAfter(latest) ? current : latest,
    );
    const endMoment = lastShowDateTime.subtract(2, DATE_UNIT.HOUR);

    resetField(SHOW_FORM_FIELDS.END_DATE, {
      defaultValue: endMoment.format(DATE_FORMAT.FULL_TIMEZONE),
    });
  }, [schedules, resetField]);

  // 메인 포스터 파일 변경 핸들러
  function handlePosterChange(files: File[]) {
    setPosterFile(files.length > 0 ? files[0] : null);

    // 파일이 첨부되면 에러 메시지 제거
    if (files.length > 0) {
      clearErrors('root.poster');
    }
  }

  // 상세 이미지 파일 변경 핸들러
  function handleDetailImagesChange(files: File[], deletedIds: number[]) {
    setDetailFiles(files);
    setDeletedDetailImageIds(deletedIds);

    // 파일이 첨부되면 에러 메시지 제거
    if (files.length > 0) {
      clearErrors('root.details');
    }
  }

  // 공연 일정 삭제 핸들러
  function handleScheduleRemove(index: number, id?: number) {
    // 수정인 경우 request용 id 별도 저장
    if (isUpdate && id) {
      setDeletedScheduleIds((ids) => [...ids, id]);
    }

    // 폼 배열 데이터 삭제
    remove(index);
  }

  // 이미지 파일 유효성 검사
  function validateImageFiles(): boolean {
    const errors: Array<{ field: string; message: string }> = [];

    // 메인 포스터
    if (!isUpdate && !posterFile) {
      errors.push({ field: 'poster', message: '메인 포스터를 첨부하세요.' });
    }
    // 상세 이미지
    if (!isUpdate && detailFiles.length === 0) {
      errors.push({ field: 'details', message: '상세 이미지를 하나 이상 첨부하세요.' });
    }

    // 에러가 있으면 모두 설정하고 false 반환
    if (errors.length > 0) {
      errors.forEach(({ field, message }) => {
        setError(`root.${field}`, { type: 'manual', message });
      });
      return false;
    }
    return true;
  }

  // create request
  function createRequestForm(form: ShowFormData): ShowUpsert.CreateForm | ShowUpsert.UpdateForm {
    const {
      title,
      genre,
      region,
      venueName,
      hallName,
      runningTime,
      cast,
      startDate,
      endDate,
      schedules,
    } = form;

    return {
      title,
      genre: genre as Genre,
      location: {
        region: region as Region,
        venueName,
        hallName,
      },
      runningTime,
      cast,
      salePeriod: {
        startDate: stringToDate(startDate),
        endDate: stringToDate(endDate),
      },
      schedules: schedules.map((schedule) => ({
        showDate: stringToDate(schedule.showDate),
        showTime: schedule.showTime,
        ticketOpenTime: stringToDate(schedule.ticketOpenTime),
        ...(isUpdate && { scheduleId: schedule.scheduleId }), // 수정이면 공연 일정 아이디 추가
      })),
      ...(isUpdate && { deletedScheduleIds, deletedDetailImageIds }), // 수정이면 공연 일정, 상세 이미지 삭제 아이디 추가
    };
  }

  // formData 생성
  function createFormData(request: ShowUpsert.CreateForm): FormData {
    const formData = new FormData();

    // data 필드를 JSON 문자열로 추가
    formData.append('data', JSON.stringify(request));

    // 포스터 파일 추가
    if (posterFile) {
      formData.append('poster', posterFile);
    }

    // 상세 이미지 파일들 추가
    detailFiles.forEach((file) => {
      formData.append('detailImages', file);
    });

    return formData;
  }

  // api request 설정
  async function onSubmit(formData: ShowFormData) {
    // 이미지 파일 유효성 검사
    if (!validateImageFiles()) return;

    // 확인 모달
    const confirmed = await confirm({
      title: `공연 ${flag}`,
      description: `${formData.title} 공연을 ${flag}하시겠습니까?`,
      confirmText: flag,
      cancelText: '취소',
    });
    if (!confirmed) return; // 취소하면 중단

    // request body
    const request = createRequestForm(formData);
    const requestFormData = createFormData(request);

    // api
    const response = isUpdate
      ? await onUpdateShow(requestFormData)
      : await onCreateShow(requestFormData);

    // 성공시 목록으로 이동 및 새로고침
    if (response.success && response?.data?.showId && response.data.showId > 0) {
      setSubmitted(true);
      if (draftKey) removeDraft(draftKey);
      router.push(ADMIN_ROUTES.SHOW);
      queryClient.refetchQueries({ queryKey: ['admin', 'show', 'list'] });
    }
  }

  // 공연 상태 (수정화면에서만)
  const statusField = (
    <FormField isLoading={loading} label="상태" htmlFor="status">
      {data?.status ? <StatusBadge type="show" status={data.status} /> : null}
    </FormField>
  );

  return (
    <PageCard>
      <PageCard.Title useRouteBack={true} onBack={() => confirmLeave(router.back)}>
        공연 {flag}
      </PageCard.Title>
      <PageCard.Content>
        {!mounted ? (
          // 서버 사이드에서 렌더링 중에 로딩 화면 표시
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit, (errors) => console.warn('유효성 검사 실패', errors))}
          >
            <div className="space-y-6">
              {/* 0. 공연 상태 */}
              {isUpdate && statusField}

              {/* 1. 제목 */}
              <FormInputField
                isLoading={loading}
                name={SHOW_FORM_FIELDS.TITLE}
                label="제목"
                htmlFor={SHOW_FORM_FIELDS.TITLE}
                register={register}
                errors={errors}
                placeholder="제목을 입력하세요. (100자 이내)"
                required={true}
              />

              {/* 2. 장르 */}
              <FormSelectField
                isLoading={loading}
                name={SHOW_FORM_FIELDS.GENRE}
                label="장르"
                htmlFor={SHOW_FORM_FIELDS.GENRE}
                control={control}
                errors={errors}
                options={GENRE_OPTIONS}
                placeholder="장르를 선택하세요."
                required={true}
                disabled={isDisabledEdit}
              />

              {/* 3. 지역 */}
              <FormSelectField
                isLoading={loading}
                name={SHOW_FORM_FIELDS.REGION}
                label="지역"
                htmlFor={SHOW_FORM_FIELDS.REGION}
                control={control}
                errors={errors}
                options={REGION_OPTIONS}
                placeholder="지역을 선택하세요."
                required={true}
                disabled={isDisabledEdit}
              />

              {/* 4. 장소 */}
              <FormSelectField
                isLoading={loading}
                name={SHOW_FORM_FIELDS.VENUE_NAME}
                label="장소"
                htmlFor={SHOW_FORM_FIELDS.VENUE_NAME}
                control={control}
                errors={errors}
                options={venueOptions}
                placeholder={venuePlaceholder}
                required={true}
                className="xl:col-span-1"
                disabled={isDisabledEdit || !watchedRegion}
              />

              {/* 5. 공연장 */}
              <FormSelectField
                isLoading={loading}
                name={SHOW_FORM_FIELDS.HALL_NAME}
                label="공연장"
                htmlFor={SHOW_FORM_FIELDS.HALL_NAME}
                control={control}
                errors={errors}
                options={hallOptions}
                placeholder={hallPlaceholder}
                required={true}
                className="xl:col-span-1"
                disabled={isDisabledEdit || !watchedRegion || !watchedVenueName}
              />

              {/* 6. 관람시간 */}
              <FormInputField
                isLoading={loading}
                name={SHOW_FORM_FIELDS.RUNNING_TIME}
                label="관람시간"
                htmlFor={SHOW_FORM_FIELDS.RUNNING_TIME}
                register={register}
                errors={errors}
                placeholder="관람시간을 입력하세요. (분 단위, ex. 100분)"
                required={true}
              />

              {/* 7. 출연진 */}
              <FormInputField
                isLoading={loading}
                name={SHOW_FORM_FIELDS.CAST}
                label="출연진"
                htmlFor={SHOW_FORM_FIELDS.CAST}
                register={register}
                errors={errors}
                placeholder="출연진을 입력하세요. (500자 이내)"
                required={true}
              />

              {/* 8. 일정(테이블) */}
              <FormField
                isLoading={loading}
                label="일정"
                htmlFor={SHOW_FORM_FIELDS.SCHEDULES}
                required={true}
                error={errors?.schedules?.message}
                description={
                  isUpdate ? '예매된 좌석이 있는 일정은 수정 및 삭제할 수 없습니다.' : ''
                }
              >
                <FormScheduleTableField<ShowFormData>
                  fields={fields}
                  register={register}
                  scheduleErrors={errors?.schedules as FieldErrors<ShowUpsert.Schedule[]>}
                  removeSchedule={handleScheduleRemove}
                  addSchedule={() => append(createEmptySchedule())}
                />
              </FormField>

              {/* 9. 예매 시작일 */}
              <FormInputField
                isLoading={loading}
                name={SHOW_FORM_FIELDS.START_DATE}
                label="예매 시작일"
                htmlFor={SHOW_FORM_FIELDS.START_DATE}
                type="datetime-local"
                register={register}
                errors={errors}
                placeholder="예매 시작일을 입력하세요."
                required={true}
                description="예매 종료일은 마지막 공연일로 자동 설정됩니다."
                disabled={isDisabledEdit}
              />

              {/* 10. 메인 포스터 */}
              <FormFileField
                isLoading={loading}
                label="메인 포스터"
                htmlFor="poster"
                required={true}
                maxSize={5}
                onFileChange={handlePosterChange}
                error={errors.root?.poster?.message}
                previewImages={data?.posterUrl || undefined}
              />

              {/* 11. 상세 이미지 */}
              <FormFileField
                isLoading={loading}
                label="상세 이미지"
                htmlFor="detail-images"
                required={true}
                multiple={true}
                maxSize={5}
                onFileChange={handleDetailImagesChange}
                error={errors.root?.details?.message}
                previewImages={data?.detailImages || []}
              />

              {/*footer*/}
              <div className="flex gap-4 border-t pt-6">
                {loading ? (
                  <>
                    <Skeleton className="h-12 flex-1" />
                    <Skeleton className="h-12 flex-1" />
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="h-12 flex-1 text-base"
                      onClick={() => confirmLeave(router.back)}
                    >
                      이전
                    </Button>
                    {!isUpdate && (
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="h-12 flex-1 text-base"
                        onClick={handleSaveDraft}
                        disabled={!draftKey || !isDirty}
                      >
                        임시저장
                      </Button>
                    )}
                    <Button
                      type="submit"
                      size="lg"
                      className="h-12 flex-1 text-base"
                      disabled={isSubmitting}
                    >
                      {flag}
                    </Button>
                  </>
                )}
              </div>
              {draftSavedAt && (
                <p className="text-muted-foreground -mt-3 text-right text-sm">
                  임시저장됨 {dayjs(draftSavedAt).format('HH:mm')}
                </p>
              )}
            </div>
          </form>
        )}
      </PageCard.Content>
    </PageCard>
  );
}
