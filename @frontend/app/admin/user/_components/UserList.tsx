'use client';

import { Skeleton } from '@/components/atoms';
import { useAlert } from '@/components/molecules/AlertContext';
import { ToggleDropdown } from '@/components/molecules/ToggleDropdown';
import { PageCard } from '@/components/molecules/PageCard';
import { BaseTable, type BaseTableColumn } from '@/components/organisms';
import { DATE_FORMAT } from '@/constants/common/dateFormat';
import dayjs from '@/plugins/dayjs';
import { changeUserStatus, getUserList } from '@/lib/api/admin/user';
import { useMutation, useQuery } from '@tanstack/react-query';
import React, { startTransition, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { Gender, SocialProvider, UserStatus } from '@shared/enums';
import StatusBadge from '@/components/molecules/StatusBadge';
import { USER_STATUS_LABELS } from '@/constants/common/userStatus';
import { GENDER_LABELS } from '@/constants/common/gender';
import { labelKeys, labelOptions, toFilterValues } from '@/lib/admin/table-filter';
import {
  oneOfParam,
  pageParam,
  pageSizeParam,
  parseSort,
  sortParam,
  toSortParam,
  useTableParams,
} from '@/lib/admin/table-params';
import { ROLE_LABELS } from '@/constants/common/role';

const SOCIAL_PROVIDER_LABELS: Record<SocialProvider, string> = {
  KAKAO: '카카오',
  NAVER: '네이버',
  GOOGLE: '구글',
};

// 주소 쿼리. 검색어(이름·이메일·연락처)는 개인정보라 방문 기록에 남지 않도록 주소에 넣지 않음
const userListSchema = z.object({
  page: pageParam,
  size: pageSizeParam,
  sort: sortParam(['id', 'name', 'email', 'createdAt']),
  status: oneOfParam(labelKeys(USER_STATUS_LABELS)),
  gender: oneOfParam(labelKeys(GENDER_LABELS)),
  socialProvider: oneOfParam(labelKeys(SOCIAL_PROVIDER_LABELS)),
});

const INITIAL_SEARCH = { keyword: '', column: 'all' };

const FILTER_OPTIONS = {
  status: labelOptions(USER_STATUS_LABELS),
  gender: labelOptions(GENDER_LABELS),
  socialProvider: labelOptions(SOCIAL_PROVIDER_LABELS),
};

export default function UserList() {
  const { confirmWithInput } = useAlert();

  const [mounted, setMounted] = useState(false);

  const { params: query, setParams, isDefault, resetParams } = useTableParams(userListSchema);
  const sort = parseSort(query.sort);
  const [search, setSearch] = useState(INITIAL_SEARCH);

  const params: User.ListParams = useMemo(() => {
    const { column, order } = parseSort(query.sort);
    return {
      page: query.page - 1,
      size: query.size,
      ...(column && { sort: `${column},${order}` }),
      ...(search.keyword && { keyword: search.keyword }), // 전체 검색
      ...(search.keyword && search.column !== 'all' && { searchType: search.column }), // 컬럼 검색
      ...(query.status && { status: query.status }),
      ...(query.gender && { gender: query.gender }),
      ...(query.socialProvider && { socialProvider: query.socialProvider }),
    };
  }, [query, search]);

  const { data, isFetching, refetch } = useQuery(getUserList(params));
  const { mutateAsync: onChangeUserStatus, isPending: changePending } =
    useMutation(changeUserStatus());

  const loading = isFetching || changePending;
  const userList = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  const columns: BaseTableColumn<User.List>[] = [
    {
      key: 'id',
      label: '번호',
      render: (user) => user.id || '-',
      sorter: true,
    },
    {
      key: 'name',
      label: '이름',
      render: (user) => user.name || '-',
      search: true,
      sorter: true,
    },
    {
      key: 'status',
      label: '상태',
      render: (user) => <StatusBadge type="user" status={user.status as UserStatus} />,
      filter: true,
      filterOptions: FILTER_OPTIONS.status,
    },
    {
      key: 'gender',
      label: '성별',
      render: (user) => <StatusBadge type="gender" status={user.gender as Gender} />,
      filter: true,
      filterOptions: FILTER_OPTIONS.gender,
    },
    {
      key: 'email',
      label: '이메일',
      render: (user) => user.email || '-',
      search: true,
      sorter: true,
    },
    {
      key: 'phone',
      label: '연락처',
      render: (user) => user.phone || '-',
      search: true,
    },
    {
      key: 'socialProvider',
      label: '소셜 연동',
      render: (user) =>
        SOCIAL_PROVIDER_LABELS[user.socialProvider as SocialProvider] ??
        (user.socialProvider || '-'),
      filter: true,
      filterOptions: FILTER_OPTIONS.socialProvider,
    },
    {
      key: 'role',
      label: '권한',
      render: (user) => ROLE_LABELS[user.role],
    },
    {
      key: 'createdAt',
      label: '가입일',
      sorter: true,
      render: (user) =>
        user.createdAt ? dayjs(user.createdAt).format(DATE_FORMAT.DATE_ONLY) : '-',
    },
    {
      key: 'toggle',
      label: '',
      render: (user) => {
        const isActive = user.status === 'ACTIVE';
        const requestLabel = isActive ? '강제 탈퇴' : '회원 복구';

        return (
          <ToggleDropdown
            items={[
              {
                label: requestLabel,
                onClick: () => handleUserStatusChange(user.id, user.name, isActive, requestLabel),
                disabled: user.status === 'DELETED', // 이미 삭제된 경우,
                ...(isActive && { variant: 'destructive' }),
              },
            ]}
          />
        );
      },
    },
  ];

  async function handleUserStatusChange(
    id: number,
    name: string,
    isActive: boolean,
    label: string,
  ) {
    const requestStatus = isActive ? 'SUSPENDED' : 'ACTIVE';

    const result = await confirmWithInput({
      title: '회원 설정',
      description: `${name} 회원을 [${label}] 처리하시겠습니까?`,
      confirmText: '설정',
      input: {
        label: '사유',
        placeholder: '변경 사유를 입력하세요.',
        required: true,
      },
    });
    if (result.confirmed) {
      await onChangeUserStatus({ id, status: requestStatus, reason: result.value });
      refetch();
    }
  }

  function handleSearch(keyword: string, column: string) {
    setSearch({ keyword: keyword.trim(), column });
    setParams({ page: 1 });
  }

  return (
    <PageCard>
      <PageCard.Title useRouteBack={false}>회원 목록</PageCard.Title>
      <PageCard.Content>
        {!mounted ? (
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <BaseTable
            data={userList}
            columns={columns}
            searchKeyword={search.keyword}
            searchColumn={search.column}
            onSearch={handleSearch}
            filterValues={toFilterValues({
              status: query.status,
              gender: query.gender,
              socialProvider: query.socialProvider,
            })}
            onFilter={(key, values) => setParams({ [key]: values[0] })}
            page={query.page - 1}
            canReset={!isDefault || !!search.keyword}
            // 주소 이동과 함께 반영해야 '검색어만 빈 조건'으로 한 번 더 조회하지 않음
            onReset={() =>
              startTransition(() => {
                setSearch(INITIAL_SEARCH);
                resetParams();
              })
            }
            sortColumn={sort.column}
            sortOrder={sort.order}
            onSort={(column, order) => setParams({ sort: toSortParam(column, order) })}
            totalPages={totalPages}
            pageSize={query.size}
            onPageChange={(page) => setParams({ page: page + 1 })}
            onPageSizeChange={(size) => setParams({ size })}
            isLoading={loading}
            emptyMessage="등록된 회원이 없습니다."
          />
        )}
      </PageCard.Content>
    </PageCard>
  );
}
