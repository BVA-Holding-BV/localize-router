import { Injectable } from '@angular/core';
import { Router, NavigationStart, ActivatedRouteSnapshot } from '@angular/router';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import 'rxjs/add/observable/forkJoin';

import { LocalizeParser } from './localize-router.parser';

/**
 * Localization service
 * modifyRoutes
 */
@Injectable()
export class LocalizeRouterService {
  routerEvents: Subject<string>;

  /**
   * CTOR
   * @param parser
   * @param router
   */
  constructor(public parser: LocalizeParser, private router: Router) {
    this.routerEvents = new Subject<string>();
  }

  /**
   * Start up the service
   */
  init() {
    this.router.resetConfig(this.parser.routes);
    this.router.events.subscribe(this._routeChanged());
  }

  /**
   * Change language and navigate to translated route
   * @param lang
   */
  changeLanguage(lang: string) {
    if (lang !== this.parser.currentLang) {
      let rootSnapshot: ActivatedRouteSnapshot = this.router.routerState.snapshot.root;

      this.parser.translateRoutes(lang).subscribe(() => {
        this.router.navigateByUrl(this.traverseRouteSnapshot(rootSnapshot));
      });
    }
  }

  /**
   * Traverses through the tree to assemble new translated url
   * @param snapshot
   * @returns {string}
   */
  private traverseRouteSnapshot(snapshot: ActivatedRouteSnapshot): string {
    if (snapshot.firstChild && snapshot.firstChild.routeConfig && snapshot.firstChild.routeConfig.path) {
      return this.parseSegmentValue(snapshot) + '/' + this.traverseRouteSnapshot(snapshot.firstChild);
    }
    return this.parseSegmentValue(snapshot);
  }

  /**
   * Extracts new segment value based on routeConfig and url
   * @param snapshot
   * @returns {any}
   */
  private parseSegmentValue(snapshot: ActivatedRouteSnapshot): string {
    if (snapshot.routeConfig) {
      let subPathSegments = snapshot.routeConfig.path.split('/');
      return subPathSegments.
      map((s: string, i: number) => s.indexOf(':') === 0 ? snapshot.url[i].path : s).
      join('/');
    }
    return '';
  }

  /**
   * Translate route to current language
   * If new language is explicitly provided then replace language part in url with new language
   * @param path
   * @returns {Observable<string>}
   */
  translateRoute(path: string | Array<any>): Observable<string | any[]> {
    if (typeof path === 'string') {
      let result = this.parser.translateRoute(path);
      return Observable.of(!path.indexOf('/') ? `/${this.parser.currentLang}${result}` : result);
    } else { // it's array
      let result: any[] = [];
      (path as Array<any>).forEach((segment: any, index: number) => {
        if (typeof segment === 'string') {
          let res = this.parser.translateRoute(segment);
          if (!index && !segment.indexOf('/')) {
            result.push(`/${this.parser.currentLang}${res}`);
          } else {
            result.push(res);
          }
        } else {
          result.push(segment);
        }
      });
      return Observable.of(result);
    }
  }

  /**
   * Event handler to react on route change
   * @returns {(event:any)=>undefined}
   * @private
   */
  private _routeChanged() {
    let self = this;

    return (event: any) => {
      let lang = self.parser.getLocationLang(event.url);
      if (event instanceof NavigationStart && lang && lang !== this.parser.currentLang) {
        this.parser.translateRoutes(lang).subscribe(() => {
          /** Fire route change event */
          this.routerEvents.next(lang);
        });
      }
    };
  }
}
