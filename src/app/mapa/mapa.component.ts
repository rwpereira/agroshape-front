import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, ViewChild } from '@angular/core';
import { GoogleMap, GoogleMapsModule } from '@angular/google-maps';
import { environment } from '../../environmensts/environment';

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [GoogleMapsModule, HttpClientModule],
  templateUrl: './mapa.component.html',
  styleUrls: ['./mapa.component.scss']
})
export class MapaComponent {
  @ViewChild(GoogleMap, { static: false }) map!: GoogleMap;

  mapOptions: google.maps.MapOptions = {
    center: { lat: -15.7801, lng: -47.9292 }, // Centro aproximado do Brasil
    zoom: 4,
    mapTypeId: google.maps.MapTypeId.HYBRID
  };

  polygons: google.maps.Polygon[] = [];

  constructor(private http: HttpClient) { }

  onMapDblClick(event: google.maps.MapMouseEvent) {
    if (event.latLng) {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      console.log(`Latitude: ${lat}, Longitude: ${lng}`);

      // Primeiro, consulta o endpoint para obter o código do imóvel
      this.fetchCarCode(lat, lng);
    }
  }

  // Consulta o endpoint "consulta/busca-car" para obter o código do imóvel
  fetchCarCode(lat: number, lng: number) {
    const apiUrl = [
      environment.api,
      `consulta/busca-car?latitude=${lat}&longitude=${lng}`
    ].join('/');

    this.http.get<any[]>(apiUrl).subscribe((data) => {
      console.log('Dados do busca-car:', data);

      // Verifica se há registros e pega o primeiro "car"
      if (data && data.length > 0 && data[0].cod_imovel) {
        const carCode = data[0].cod_imovel; // Pega o primeiro registro
        console.log(`Código do imóvel encontrado: ${carCode}`);
        this.fetchPropertyData(carCode); // Chama o próximo endpoint com o código
      } else {
        console.log('Nenhum código de imóvel encontrado.');
      }
    }, (error) => {
      console.error('Erro ao consultar busca-car:', error);
    });
  }

  // Consulta o endpoint "poligono/imovel" com o código do imóvel
  fetchPropertyData(carCode: string) {
    const apiUrl = [
      environment.api,
      `poligono/imovel?codImovel=${carCode}&imovel=true`
    ].join('/');

    this.http.get(apiUrl).subscribe((data: any) => {
      this.clearMap();
      console.log('Dados da API poligono/imovel:', data);
      this.displayGeoJsonArray(data);
    }, (error) => {
      console.error('Erro ao consultar poligono/imovel:', error);
    });
  }

  clearMap() {
    this.polygons.forEach(polygon => polygon.setMap(null));
    this.polygons = [];
  }

  // Processa o array de objetos com geojson e ajusta o mapa
  displayGeoJsonArray(data: any[]) {
    const bounds = new google.maps.LatLngBounds();

    data.forEach(item => {
      const geojson = item.geojson;
      const color = this.normalizeColor(item.cor_normal);

      if (geojson.type === 'Polygon') {
        this.addPolygon(geojson.coordinates, color, bounds);
      } else if (geojson.type === 'MultiPolygon') {
        geojson.coordinates.forEach((polygonCoords: any[]) => {
          this.addPolygon(polygonCoords, color, bounds);
        });
      }
    });

    if (this.polygons.length > 0 && this.map.googleMap) {
      this.map.googleMap.fitBounds(bounds);
    }
  }

  // Adiciona um polígono ao mapa e estende os limites
  addPolygon(coordinates: any[], color: string, bounds: google.maps.LatLngBounds) {
    const paths = coordinates.map((ring: any[]) =>
      ring.map((coord: number[]) => ({ lat: coord[0], lng: coord[1] }))
    );

    console.log('paths:', paths);

    const polygon = new google.maps.Polygon({
      paths: paths,
      strokeColor: color,
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: color,
      fillOpacity: 0.35
    });

    polygon.setMap(this.map.googleMap!);
    this.polygons.push(polygon);

    paths.forEach(ring => {
      ring.forEach(coord => {
        bounds.extend(coord);
      });
    });
  }

  // Normaliza a cor do formato "#AARRGGBB" para "#RRGGBB"
  normalizeColor(color: string): string {
    if (color.startsWith('#') && color.length === 9) {
      return `#${color.slice(3)}`;
    }
    return color;
  }
}