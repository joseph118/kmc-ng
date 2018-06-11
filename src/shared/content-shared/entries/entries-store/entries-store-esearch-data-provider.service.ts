import { Injectable, OnDestroy } from '@angular/core';
import { EntriesDataProvider, EntriesFilters, MetadataProfileData, SortDirection } from './entries-store.service';
import { KalturaBaseEntry } from 'kaltura-ngx-client/api/types/KalturaBaseEntry';
import { Observable } from 'rxjs/Observable';
import { KalturaDetachedResponseProfile } from 'kaltura-ngx-client/api/types/KalturaDetachedResponseProfile';
import { KalturaLiveStreamEntry } from 'kaltura-ngx-client/api/types/KalturaLiveStreamEntry';
import { KalturaExternalMediaEntry } from 'kaltura-ngx-client/api/types/KalturaExternalMediaEntry';
import { KalturaFilterPager } from 'kaltura-ngx-client/api/types/KalturaFilterPager';
import { KalturaResponseProfileType } from 'kaltura-ngx-client/api/types/KalturaResponseProfileType';
import { KalturaLiveStreamAdminEntry } from 'kaltura-ngx-client/api/types/KalturaLiveStreamAdminEntry';
import { KalturaUtils } from '@kaltura-ng/kaltura-common/utils/kaltura-utils';
import { KalturaClient } from 'kaltura-ngx-client';
import { CategoriesModes } from 'app-shared/content-shared/categories/categories-mode-type';
import { MetadataProfileCreateModes, MetadataProfileStore, MetadataProfileTypes } from 'app-shared/kmc-shared';
import { KMCPermissions, KMCPermissionsService } from 'app-shared/kmc-shared/kmc-permissions';
import { ESearchSearchEntryAction } from 'kaltura-ngx-client/api/types/ESearchSearchEntryAction';
import { KalturaESearchResponse } from 'kaltura-ngx-client/api/types/KalturaESearchResponse';
import { KalturaESearchEntryParams } from 'kaltura-ngx-client/api/types/KalturaESearchEntryParams';
import { KalturaESearchOrderBy } from 'kaltura-ngx-client/api/types/KalturaESearchOrderBy';
import { KalturaESearchSortOrder } from 'kaltura-ngx-client/api/types/KalturaESearchSortOrder';
import { KalturaESearchEntryOrderByItem } from 'kaltura-ngx-client/api/types/KalturaESearchEntryOrderByItem';
import { KalturaESearchEntryOrderByFieldName } from 'kaltura-ngx-client/api/types/KalturaESearchEntryOrderByFieldName';
import { KalturaESearchEntryOperator } from 'kaltura-ngx-client/api/types/KalturaESearchEntryOperator';
import { KalturaESearchOperatorType } from 'kaltura-ngx-client/api/types/KalturaESearchOperatorType';
import { KalturaESearchEntryItem } from 'kaltura-ngx-client/api/types/KalturaESearchEntryItem';
import { KalturaESearchItemType } from 'kaltura-ngx-client/api/types/KalturaESearchItemType';
import { KalturaESearchRange } from 'kaltura-ngx-client/api/types/KalturaESearchRange';
import { KalturaESearchEntryFieldName } from 'kaltura-ngx-client/api/types/KalturaESearchEntryFieldName';
import { KalturaESearchCategoryEntryItem } from 'kaltura-ngx-client/api/types/KalturaESearchCategoryEntryItem';
import { KalturaESearchCategoryEntryFieldName } from 'kaltura-ngx-client/api/types/KalturaESearchCategoryEntryFieldName';
import { KalturaESearchEntryBaseItem } from 'kaltura-ngx-client/api/types/KalturaESearchEntryBaseItem';
import { KalturaMediaType } from 'kaltura-ngx-client/api/types/KalturaMediaType';


@Injectable()
export class EntriesStoreEsearchDataProvider implements EntriesDataProvider, OnDestroy {
    constructor(private _kalturaServerClient: KalturaClient,
                private _appPermissions: KMCPermissionsService,
                private _metadataProfileService: MetadataProfileStore) {
    }

    ngOnDestroy() {

    }

    private _updateSearchParamsWithJoinedList(list: any[],
                                              searchItems: KalturaESearchEntryBaseItem[],
                                              fieldName: KalturaESearchEntryFieldName): void {
        const value = (list || []).map(item => item).join(',');

        if (value) {
            searchItems.push(new KalturaESearchEntryItem({
                searchTerm: value,
                fieldName,
                // itemType: KalturaESearchItemType.partial TODO esearch
            }));
        }
    }

    private _getMetadataProfiles(): Observable<MetadataProfileData[]> {
        return this._metadataProfileService.get({
            type: MetadataProfileTypes.Entry,
            ignoredCreateMode: MetadataProfileCreateModes.App
        })
            .cancelOnDestroy(this)
            .first()
            .map(metadataProfiles => {
                return metadataProfiles.items.map(metadataProfile => ({
                    id: metadataProfile.id,
                    name: metadataProfile.name,
                    lists: (metadataProfile.items || []).map(item => ({ id: item.id, name: item.name }))
                }));
            });
    }

    public getServerFilter(data: EntriesFilters): Observable<KalturaESearchEntryParams | any> {
        try {
            return this._getMetadataProfiles()
                .map(metadataProfiles => {
                    // create request items
                    const searchParams = new KalturaESearchEntryParams({});
                    let mediaTypeSearchItem: KalturaESearchEntryItem;
                    // const advancedSearch = searchParams.advancedSearch = new KalturaSearchOperator({});
                    // advancedSearch.type = KalturaSearchOperatorType.searchAnd;

                    searchParams.searchOperator = new KalturaESearchEntryOperator({
                        operator: KalturaESearchOperatorType.andOp,
                        searchItems: []
                    });
                    // filter 'freeText'
                    if (data.freetext) {
                        searchParams.searchOperator.searchItems.push(
                            new KalturaESearchEntryItem({
                                searchTerm: data.freetext,
                                itemType: KalturaESearchItemType.partial,
                                fieldName: KalturaESearchEntryFieldName._name // TODO esearch
                            })
                        );
                    }

                    // filter 'createdAt'
                    if (data.createdAt && (data.createdAt.fromDate || data.createdAt.toDate)) {
                        const createdAtSearchItem = new KalturaESearchEntryItem({
                            fieldName: KalturaESearchEntryFieldName.createdAt,
                            range: new KalturaESearchRange({})
                        });

                        if (data.createdAt.fromDate) {
                            createdAtSearchItem.range.greaterThanOrEqual = +KalturaUtils.getStartDateValue(data.createdAt.fromDate);
                        }

                        if (data.createdAt.toDate) {
                            createdAtSearchItem.range.lessThanOrEqual = +KalturaUtils.getEndDateValue(data.createdAt.toDate);
                        }

                        searchParams.searchOperator.searchItems.push(createdAtSearchItem);
                    }

                    // filters of joined list
                    const mediaTypes = (data.mediaTypes || []).map(item => item).join(',');
                    if (mediaTypes) {
                        mediaTypeSearchItem = new KalturaESearchEntryItem({
                            searchTerm: mediaTypes,
                            fieldName: KalturaESearchEntryFieldName.mediaType
                        });
                    }
                    const objectStatuses = (data.ingestionStatuses || []).map(item => item).join(',');
                    if (objectStatuses) {
                        searchParams.objectStatuses = objectStatuses;
                    }
                    this._updateSearchParamsWithJoinedList(data.durations, searchParams.searchOperator.searchItems, KalturaESearchEntryFieldName.lengthInMsecs); // TODO esearch duration
                    this._updateSearchParamsWithJoinedList(data.moderationStatuses, searchParams.searchOperator.searchItems, KalturaESearchEntryFieldName.moderationStatus);
                    // this._updateSearchParamsWithJoinedList(data.replacementStatuses, searchParams.searchOperator.searchItems, 'replacementStatusIn'); // TODO esearch
                    this._updateSearchParamsWithJoinedList(data.accessControlProfiles, searchParams.searchOperator.searchItems, KalturaESearchEntryFieldName.accessControlId);
                    // this._updateSearchParamsWithJoinedList(data.flavors, searchParams.searchOperator.searchItems, 'flavorParamsIdsMatchOr'); // TODO esearch

                    // filter 'distribution'
                    // if (data.distributions && data.distributions.length > 0) {
                    //     const distributionItem = new KalturaSearchOperator({
                    //         type: KalturaSearchOperatorType.searchOr
                    //     });
                    //
                    //     advancedSearch.items.push(distributionItem);
                    //
                    //     data.distributions.forEach(item => {
                    //         // very complex way to make sure the value is number (an also bypass both typescript and tslink checks)
                    //         if (isFinite(+item) && parseInt(item) == <any>item) { // tslint:disable-line
                    //             const newItem = new KalturaContentDistributionSearchItem(
                    //                 {
                    //                     distributionProfileId: +item,
                    //                     hasEntryDistributionValidationErrors: false,
                    //                     noDistributionProfiles: false
                    //                 }
                    //             );
                    //
                    //             distributionItem.items.push(newItem);
                    //         }
                    //     });
                    // }

                    // filter 'originalClippedEntries'
                    // if (data.originalClippedEntries && data.originalClippedEntries.length > 0) {
                    //     let originalClippedEntriesValue: KalturaNullableBoolean = null;
                    //
                    //     data.originalClippedEntries.forEach(item => {
                    //         switch (item) {
                    //             case '0':
                    //                 if (originalClippedEntriesValue == null) {
                    //                     originalClippedEntriesValue = KalturaNullableBoolean.falseValue;
                    //                 } else if (originalClippedEntriesValue === KalturaNullableBoolean.trueValue) {
                    //                     originalClippedEntriesValue = KalturaNullableBoolean.nullValue;
                    //                 }
                    //                 break;
                    //             case '1':
                    //                 if (originalClippedEntriesValue == null) {
                    //                     originalClippedEntriesValue = KalturaNullableBoolean.trueValue;
                    //                 } else if (originalClippedEntriesValue === KalturaNullableBoolean.falseValue) {
                    //                     originalClippedEntriesValue = KalturaNullableBoolean.nullValue;
                    //                 }
                    //                 break;
                    //         }
                    //     });
                    //
                    //     if (originalClippedEntriesValue !== null) {
                    //         searchParams.isRoot = originalClippedEntriesValue;
                    //     }
                    // }

                    // filter 'timeScheduling'
                    if (data.timeScheduling && data.timeScheduling.length > 0) {
                        data.timeScheduling.forEach(item => {
                            let relevantSearchItem: KalturaESearchEntryItem;
                            switch (item) {
                                case 'past':
                                    relevantSearchItem = <KalturaESearchEntryItem>searchParams.searchOperator.searchItems
                                        .find((searchItem: KalturaESearchEntryItem) =>
                                            searchItem.fieldName === KalturaESearchEntryFieldName.endDate
                                            && searchItem.range && searchItem.range.lessThanOrEqual < +(new Date())
                                        );
                                    if (!relevantSearchItem) {
                                        searchParams.searchOperator.searchItems.push(new KalturaESearchEntryItem({
                                            fieldName: KalturaESearchEntryFieldName.endDate,
                                            range: new KalturaESearchRange({ lessThanOrEqual: +(new Date()) })
                                        }));
                                    }
                                    break;
                                case 'live':
                                    relevantSearchItem = <KalturaESearchEntryItem>searchParams.searchOperator.searchItems
                                        .find((searchItem: KalturaESearchEntryItem) =>
                                            searchItem.fieldName === KalturaESearchEntryFieldName.startDate
                                            && searchItem.range && searchItem.range.lessThanOrEqual < +(new Date())
                                        );
                                    if (!relevantSearchItem) {
                                        searchParams.searchOperator.searchItems.push(new KalturaESearchEntryItem({
                                            fieldName: KalturaESearchEntryFieldName.startDate,
                                            range: new KalturaESearchRange({ lessThanOrEqual: +(new Date()) })
                                        }));
                                    }
                                    break;
                                case 'future':
                                    relevantSearchItem = <KalturaESearchEntryItem>searchParams.searchOperator.searchItems
                                        .find((searchItem: KalturaESearchEntryItem) =>
                                            searchItem.fieldName === KalturaESearchEntryFieldName.startDate
                                            && searchItem.range && searchItem.range.greaterThanOrEqual > +(new Date())
                                        );
                                    if (!relevantSearchItem) {
                                        searchParams.searchOperator.searchItems.push(new KalturaESearchEntryItem({
                                            fieldName: KalturaESearchEntryFieldName.startDate,
                                            range: new KalturaESearchRange({ greaterThanOrEqual: +(new Date()) })
                                        }));
                                    }
                                    break;
                                case 'scheduled':
                                    if (data.scheduledAt.fromDate) {
                                        relevantSearchItem = <KalturaESearchEntryItem>searchParams.searchOperator.searchItems
                                            .find((searchItem: KalturaESearchEntryItem) =>
                                                searchItem.fieldName === KalturaESearchEntryFieldName.startDate
                                                && searchItem.range
                                                && searchItem.range.greaterThanOrEqual > +KalturaUtils.getStartDateValue(data.scheduledAt.fromDate)
                                            );
                                        if (!relevantSearchItem) {
                                            searchParams.searchOperator.searchItems.push(new KalturaESearchEntryItem({
                                                fieldName: KalturaESearchEntryFieldName.startDate,
                                                range: new KalturaESearchRange({ greaterThanOrEqual: +KalturaUtils.getStartDateValue(data.scheduledAt.fromDate) })
                                            }));
                                        }
                                    }

                                    if (data.scheduledAt.toDate) {
                                        relevantSearchItem = <KalturaESearchEntryItem>searchParams.searchOperator.searchItems
                                            .find((searchItem: KalturaESearchEntryItem) =>
                                                searchItem.fieldName === KalturaESearchEntryFieldName.endDate
                                                && searchItem.range
                                                && searchItem.range.lessThanOrEqual < +KalturaUtils.getEndDateValue(data.scheduledAt.fromDate)
                                            );
                                        if (!relevantSearchItem) {
                                            searchParams.searchOperator.searchItems.push(new KalturaESearchEntryItem({
                                                fieldName: KalturaESearchEntryFieldName.startDate,
                                                range: new KalturaESearchRange({ lessThanOrEqual: +KalturaUtils.getEndDateValue(data.scheduledAt.fromDate) })
                                            }));
                                        }
                                    }
                                    break;
                                default:
                                    break;
                            }
                        });
                    }

                    // filters of custom metadata lists
                    // if (metadataProfiles && metadataProfiles.length > 0) {
                    //
                    //     metadataProfiles.forEach(metadataProfile => {
                    //         // create advanced item for all metadata profiles regardless if the user filtered by them or not.
                    //         // this is needed so freetext will include all metadata profiles while searching.
                    //         const metadataItem: KalturaMetadataSearchItem = new KalturaMetadataSearchItem(
                    //             {
                    //                 metadataProfileId: metadataProfile.id,
                    //                 type: KalturaSearchOperatorType.searchAnd,
                    //                 items: []
                    //             }
                    //         );
                    //         advancedSearch.items.push(metadataItem);
                    //
                    //         metadataProfile.lists.forEach(list => {
                    //             const metadataProfileFilters = data.customMetadata[list.id];
                    //             if (metadataProfileFilters && metadataProfileFilters.length > 0) {
                    //                 const innerMetadataItem: KalturaMetadataSearchItem = new KalturaMetadataSearchItem({
                    //                     metadataProfileId: metadataProfile.id,
                    //                     type: KalturaSearchOperatorType.searchOr,
                    //                     items: []
                    //                 });
                    //                 metadataItem.items.push(innerMetadataItem);
                    //
                    //                 metadataProfileFilters.forEach(filterItem => {
                    //                     const searchItem = new KalturaSearchCondition({
                    //                         field: `/*[local-name()='metadata']/*[local-name()='${list.name}']`,
                    //                         value: filterItem
                    //                     });
                    //
                    //                     innerMetadataItem.items.push(searchItem);
                    //                 });
                    //             }
                    //         });
                    //     });
                    // }

                    if (data.categories && data.categories.length) {
                        const categoriesValue = data.categories.map(item => item).join(',');
                        const categoriesSearchItem = new KalturaESearchCategoryEntryItem({
                            searchTerm: categoriesValue,
                            // itemType: KalturaESearchItemType.partial, TODO esearch investigate if needed
                        });
                        if (data.categoriesMode === CategoriesModes.SelfAndChildren) {
                            categoriesSearchItem.fieldName = KalturaESearchCategoryEntryFieldName.ancestorId;
                        } else {
                            categoriesSearchItem.fieldName = KalturaESearchCategoryEntryFieldName.id;
                        }
                    }

                    // remove advanced search arg if it is empty
                    // if (advancedSearch.items && advancedSearch.items.length === 0) {
                    //     delete searchParams.advancedSearch;
                    // }

                    // handle default value for media types
                    if (!mediaTypeSearchItem) {
                        let mediaTypeIn = '1,2,5,6';
                        const mediaTypeInArray = [KalturaMediaType.video, KalturaMediaType.audio]
                        if (this._appPermissions.hasPermission(KMCPermissions.FEATURE_LIVE_STREAM)) {
                            mediaTypeIn += ',201';
                        }
                        mediaTypeSearchItem = new KalturaESearchEntryItem({
                            fieldName: KalturaESearchEntryFieldName.mediaType,
                            itemType: KalturaESearchItemType.exactMatch, // TODO [esearch] only exact match allowed
                            searchTerm: mediaTypeIn
                        });
                    }

                    searchParams.searchOperator.searchItems.push(mediaTypeSearchItem);

                    // handle default value for statuses
                    if (!searchParams.objectStatuses) {
                        searchParams.objectStatuses = '-1,-2,0,1,2,7,4';
                    }

                    // update the sort by args
                    if (data.sortBy) {
                        // `${data.sortDirection === SortDirection.Desc ? '-' : '+'}${data.sortBy}`;
                        searchParams.orderBy = new KalturaESearchOrderBy({
                            orderItems: [
                                new KalturaESearchEntryOrderByItem({
                                    sortField: KalturaESearchEntryOrderByFieldName.createdAt, // TODO [esearch] sortField mapping
                                    sortOrder: data.sortDirection === SortDirection.Desc
                                        ? KalturaESearchSortOrder.orderByDesc
                                        : KalturaESearchSortOrder.orderByAsc
                                })
                            ]
                        });
                    }

                    return searchParams;
                });
        } catch (err) {
            return Observable.throw(err);
        }
    }


    public executeQuery(data: EntriesFilters): Observable<{ entries: KalturaBaseEntry[], totalCount?: number }> {
        const responseProfile: KalturaDetachedResponseProfile = new KalturaDetachedResponseProfile({
            type: KalturaResponseProfileType.includeFields,
            fields: 'id,name,thumbnailUrl,mediaType,plays,createdAt,duration,status,startDate,endDate,moderationStatus,moderationCount,tags,categoriesIds,downloadUrl,sourceType,entitledUsersPublish,entitledUsersEdit'
        });
        let pager: KalturaFilterPager = null;

        // update pagination args
        if (data.pageIndex || data.pageSize) {
            pager = new KalturaFilterPager(
                {
                    pageSize: data.pageSize,
                    pageIndex: data.pageIndex + 1
                }
            );
        }

        // build the request
        return <any>
            this.getServerFilter(data)
                .switchMap(searchParams => this._kalturaServerClient.request(
                    new ESearchSearchEntryAction({ searchParams, pager })
                        .setRequestOptions({
                            responseProfile,
                            acceptedTypes: [KalturaLiveStreamAdminEntry, KalturaLiveStreamEntry, KalturaExternalMediaEntry]
                        })
                )).map((response: KalturaESearchResponse) => ({ entries: response.objects, totalCount: response.totalCount })
            );
    }

    public getDefaultFilterValues(savedAutoSelectChildren: CategoriesModes, pageSize: number): EntriesFilters {
        const categoriesMode = typeof savedAutoSelectChildren === 'number'
            ? savedAutoSelectChildren
            : CategoriesModes.SelfAndChildren;

        return {
            freetext: '',
            pageSize: pageSize,
            pageIndex: 0,
            sortBy: 'createdAt',
            sortDirection: SortDirection.Desc,
            createdAt: { fromDate: null, toDate: null },
            scheduledAt: { fromDate: null, toDate: null },
            mediaTypes: [],
            timeScheduling: [],
            ingestionStatuses: [],
            durations: [],
            originalClippedEntries: [],
            moderationStatuses: [],
            replacementStatuses: [],
            accessControlProfiles: [],
            flavors: [],
            distributions: [], categories: [],
            categoriesMode,
            customMetadata: {},
            limits: 200,
        };
    }
}
