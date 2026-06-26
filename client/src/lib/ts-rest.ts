/**
 * @fileoverview ts-rest client configuration
 */

import type { AppRouteMutation, ClientInferRequest } from '@ts-rest/core'
import { initClient, tsRestFetchApi } from '@ts-rest/core'

import { firebaseAuth } from '@/lib/auth-client'
import { contract } from '~/shared/contract'

export const tsr = initClient(contract, {
  baseUrl: '',
  baseHeaders: {},
  api: async (args) => {
    const token = (await firebaseAuth.currentUser?.getIdToken()) ?? null
    return tsRestFetchApi({
      ...args,
      headers: {
        ...args.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  },
  validateResponse: true,
})

export type ClientInferRequestBody<T extends AppRouteMutation> =
  ClientInferRequest<T>['body']
