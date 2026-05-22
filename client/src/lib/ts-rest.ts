/**
 * @fileoverview ts-rest client configuration
 */

import type { AppRouteMutation, ClientInferRequest } from '@ts-rest/core'
import { initClient } from '@ts-rest/core'

import { contract } from '~/shared/contract'

export const tsr = initClient(contract, {
  baseUrl: '',
  baseHeaders: {},
  credentials: 'include',
})

export type ClientInferRequestBody<T extends AppRouteMutation> =
  ClientInferRequest<T>['body']
